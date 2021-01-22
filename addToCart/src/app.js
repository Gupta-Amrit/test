const axios = require('axios')
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())

app.post('/addToCart', (req, res) => {
    /* Import Frontend Data */
    let frontend_data = req.body
    let headers = extractHeaders(req.headers)

    let bundles = frontend_data.bundles
    for(let i in bundles) {
        let orderEntries = bundles[i]['orderEntries']
        for(let j in orderEntries) {
            let productId = orderEntries[j]['productId']
            let storeIds = orderEntries[j]['storeIds']

            /* Construct Inventory Request */
            let inventory_request = {
                stockDetails : [
                    {
                        productCode : productId,
                        storeWareHouseIds : storeIds
                    }
                ]
            }

            /* Call Inventory API */
            let inventory_data = JSON.stringify(inventory_request)
            let inventory_config = {
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
                for (let k in inventory_response_data) {
                    let required_response = {
                        productCode : inventory_response_data[k].productCode,
                        inStockStatus : false
                    }

                    let check_data = inventory_response_data.some((object, index) => {
                        if (object.inStockStatus === required_response.inStockStatus) {
                            return true
                        }
                        return false
                    })

                    /* Check inventory availability */
                    if (check_data == true) {
                        let inventory_error = {
                            status : 500,
                            message : "ERROR",
                            error : {
                                message : `Sorry! Inventory is not available for Product ${orderEntries[j].name}`
                            },
                            code : "ERR001"
                        }
                        res.send(inventory_error)
                    }

                    else {
                        let params = extractParams(req.query)
                        let overrideBundle = params['overrideBundle'] || null

                        if (overrideBundle === "yes") {
                            /* Call UpdateCart API */
                            let updateCart_data = JSON.stringify(frontend_data)
                            let updateCart_config = {
                                method : 'post',
                                url : 'http://caas.dev-r2-uc.tatadigital.com/carts/updateCart',
                                headers : {
                                    "customerId" : headers['customerid'],
                                    "X-programID" : headers['x-programid'],
                                    "Content-Type" : "application/json"
                                },
                                data : updateCart_data
                            }

                            /* Get UpdateCart Response */
                            axios(updateCart_config)
                            .then((response) => {
                                res.send(response.data)
                            })
                            .catch((error) => {
                                if (error) {
                                    let updateCart_error = {
                                        status : 400,
                                        message : "BAD REQUEST",
                                        error : {
                                            message : "Sorry! Wronf Bundle Id"
                                        },
                                        code : "ERR002"
                                    }
                                    res.send(updateCart_error)
                                }
                            })
                        }

                        else if (overrideBundle === null) {
                            /* Call AddToCart API */
                            let addToCart_data = JSON.stringify(frontend_data)
                            let addToCart_config = {
                                method : 'post',
                                url : 'http://caas.dev-r2-uc.tatadigital.com/carts/addToCart',
                                headers : {
                                    "customerId" : headers['customerid'],
                                    "X-ProgramID" : headers['x-programid'],
                                    "Content-Type" : "application/json"
                                },
                                data : addToCart_data
                            }

                            /* Get AddToCart response */
                            axios(addToCart_config)
                            .then((response) => {
                                res.send(response.data)
                            })
                            .catch((error) => {
                                if (error) {
                                    let addToCart_error = {
                                        status : 400,
                                        message : "BAD REQUEST",
                                        error : {
                                            message : "Sorry! Bundle is already present in cart"
                                        },
                                        code : "ERR003"
                                    }
                                    res.send(addToCart_error)
                                }
                            })
                        }
                    }
                }
            })
            .catch((error) => {
                if (error) {
                    let error = {
                        status : 500,
                        message : "ERROR",
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

/* Extract Params */
function extractParams(params) {
    const traceParams = ["overrideBundle"]
    var param_map = {}
    for (let p in traceParams) {
        let paramName = traceParams[p]
        let paramValue = params[paramName]
        if (paramValue !== undefined) {
            param_map[paramName] = paramValue
        }
    }
    return param_map
}

app.listen(3000, () => {
    console.log("Server is up on port 3000")
})
