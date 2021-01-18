const axios = require('axios')
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())

app.get('/', (req, res) => {
    /* Import Frontend Data */
    let frontend_data = req.body
    let headers = extractHeaders(req.headers)

    let bundles = frontend_data.bundles
    for ( let i in bundles ) {
        let orderEntries = bundles[i].orderEntries
        for ( let j in orderEntries ) {
            let productId = orderEntries[j]['productId']
            let storeIds = orderEntries[j]['storeIds']
            let quantity = orderEntries[j]['quantity']

            /* Construct Request-Body for InventoryStatus API */
            let inventory_request = {
                stockDetails : [
                    {
                        productCode : productId,
                        storeWareHouseIds : storeIds
                    }
                ]
            }
            /* Call InventoryStatus API */
            let inventory_data = JSON.stringify(inventory_request)
            var inventory_config = {
                method : 'post',
                url : 'http://inventory.dev-r2-uc.tatadigital.com/inventory/status',
                headers : {
                    "X-ProgramID" : headers['x-programid'],
                    "Content-Type" : headers['content-type']
                },
                data : inventory_data
            }

            axios(inventory_config)
            .then((response) => {
                 /* Get Inventory Response */
                let inventory_response = response.data
                let inventory_response_data = inventory_response.data

                for ( let k in inventory_response_data ) {
                    let required_response = {productCode : inventory_response_data[k].productCode, inStockStatus : false}

                    let check_stock = inventory_response_data.some((object, index) => {
                        if(object.inStockStatus === required_response.inStockStatus) {
                            return true
                        }
                        return false
                    })

                    /* Check availability of Product */
                    if (check_stock == true) {
                        let missing_product = inventory_response_data.filter((object) => {
                            if(object.inStockStatus === required_response.inStockStatus) {
                                return object
                            }
                        })

                        for (let m in missing_product) {
                            let missing_product_error = {
                                status : 500,
                                message : "ERROR",
                                error : {
                                    message : `Sorry! Inventory is not available for Product ${missing_product[m].productCode}`
                                },
                                code : "ERR001"
                            }
                            res.send(missing_product_error)
                        }
                    }

                    /* Check wheather enough stock is avilable or not */
                    else if (quantity > inventory_response_data[k].qty) {
                        let less_product = {
                            status : 500,
                            message : "ERROR",
                            error : {
                                message : `Sorry! Not enough stock for Product ${inventory_response_data[k].productCode}`
                            },
                            code : "ERR002"
                        }
                        res.send(less_product)
                    }

                    /* Call AddToCart API */
                    else {
                        let addToCart_data = JSON.stringify(frontend_data)
                        let addToCart_config = {
                            method : 'post',
                            url : 'http://caas.dev-r2-uc.tatadigital.com/carts/addToCart',
                            headers : {
                                "customerId" : headers['customerid'],
                                "X-ProgramID" : headers['x-programid'],
                                "Content-Type" : headers['content-type']
                            },
                            data : addToCart_data
                        }

                        axios(addToCart_config)
                        .then((response) => {
                            res.send(response.data)
                        })
                        .catch((error) => {
                            if (error) {
                                 /* Call UpdateCart API */
                                let updateCart_data = JSON.stringify(frontend_data)
                                let updateCart_config = {
                                    method : 'post',
                                    url : 'http://caas.dev-r2-uc.tatadigital.com/carts/updateCart',
                                    headers : {
                                        "customerId" : headers['customerid'],
                                        "X-ProgramID" : headers['x-programid'],
                                        "Content-Type" : headers['content-type']
                                    },
                                    data : updateCart_data
                                }

                                axios (updateCart_config)
                                .then((response) => {
                                    res.send(response.data)
                                })
                                .catch((error) => {
                                    if (error) {
                                        let cart_error = {
                                            status : 400,
                                            message : "BAD REQUEST",
                                            error : {
                                                message : "Please check input credentials"
                                            },
                                            code : "ERR003"
                                        }
                                        res.send(cart_error)
                                    }
                                })
                            }
                        })
                    }
                }
            })
            .catch(function (error) {
                if (error) {
                    let error = {
                        status : 400,
                        message : "BAD REQUEST",
                        error : {
                            message : "Please check inventory details"
                        },
                        code : "ERR004"
                    }
                    res.send(error)
                }
            })
        }
    }
})

/* Extract Headers */
function extractHeaders(headers) {
    const traceHeaders = ["x-programid", "customerid"]
    var header_map = {}
    for (let h in traceHeaders) {
        let headerName = traceHeaders[h]
        let headerValue = headers[headerName]
        if (headerValue !== undefined) {
            header_map[headerName] = headerValue
        }
    }
    return header_map
}

app.listen(3000, () => {
    console.log("Server is up on port 3000")
})
