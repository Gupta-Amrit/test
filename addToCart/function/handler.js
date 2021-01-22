const axios = require('axios')

module.exports = { 
  main: async function (event, context) {
    /* Import Frontend Data */
    let input_data = event.extensions.request.body
    let frontend_data = JSON.parse(input_data.toString())
    let headers = extractHeaders(event.extensions.request.headers)

    let bundles = frontend_data.bundles
    for ( let i in bundles ) {
      let orderEntries = bundles[i]['orderEntries']
      for ( let j in orderEntries ) {
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
            "Content-Type" : "application/json"
          },
          data : inventory_data
        }

        let frontend_response = axios(inventory_config)
        .then(function (response) {
          /* Get Inventory Response */
          let inventory_response = response.data
          let inventory_response_data = inventory_response.data
          for ( let k in inventory_response_data ) {
            let required_response = {
              productCode : inventory_response_data[k].productCode,
              inStockStatus : false
            }

            let check_data = inventory_response_data.some(function(object, index) {
              if (object.inStockStatus === required_response.inStockStatus) {
                return true
              }
              return false
            })

            /* Check Inventory availability */
            if(check_data == true) {
              let inventory_error = {
                status : 500,
                message : "ERROR",
                error : {
                  message : `Sorry! Inventory is not available for Product ${orderEntries[j].name}`
                },
                code : "ERR001"
              }
              return inventory_error
            }

            else {
              let params = extractParams(event.extensions.request.query)
              let overrideBundle = params['overrideBundle'] || null
              if (overrideBundle === "yes") {
                /* Call UpdateCart API */
                let updateCart_data = JSON.stringify(frontend_data)
                let updateCart_config = {
                  method : 'post',
                  url : 'http://caas.dev-r2-uc.tatadigital.com/carts/updateCart',
                  headers : {
                    "customerId" : headers['customerid'],
                    "X-ProgramID" : headers['x-programid'],
                    "Content-Type" : "application/json"
                  },
                  data : updateCart_data
                }

                /* Get UpdateCart response */
                let updateCart_response = axios(updateCart_config)
                .then(function (response) {
                  return response.data
                })
                .catch(function (error) {
                  if (error) {
                    let updateCart_error = {
                      status : 400,
                      message : "BAD REQUEST",
                      error : {
                        message : "Sorry! Wrong Bundle Id"
                      },
                      code : "ERR002"
                    }
                    return updateCart_error
                  }
                })
                return updateCart_response
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
                let addToCart_response = axios(addToCart_config)
                .then(function (response) {
                  return response.data
                })
                .catch(function (error) {
                  if (error) {
                    let addToCart_error = {
                      status : 400,
                      message : "BAD REQUEST",
                      error : {
                        message : "Sorry! Bundle is already present in cart"
                      },
                      code : "ERR003"
                    }
                    return addToCart_error
                  }
                })
                return addToCart_response
              }
            }
          }
        })
        .catch(function (error) {
          if (error) {
            let error = {
              status : 500,
              message : "ERROR",
              error : {
                message : "Please check inventory details"
              },
              code : "ERR004"
            }
            return error
          }
        })
        return frontend_response
      }
    }
    
  }
}

/* Extract Headers */
function extractHeaders(headers) {
  let traceHeaders = ["x-programid", "customerid"]
  let header_map = {}
  for ( let h in traceHeaders ) {
    let headerName = traceHeaders[h]
    let headerValue = headers[headerName]
    if ( headerValue !== undefined) {
      header_map[headerName] = headerValue
    }
  }
  return header_map
}

/* Extract Params */
function extractParams(params) {
  let traceParams = ["overrideBundle"]
  let param_map = {}
  for ( let p in traceParams ) {
    let paramName = traceParams[p]
    let paramValue = params[paramName]
    if (paramValue !== undefined) {
      param_map[paramName] = paramValue 
    }
  }
  return param_map
}