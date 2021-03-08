const axios = require('axios')

module.exports = { 
  main: async function (event, context) {
    let input_data = event.extensions.request.body
    let frontend_data = JSON.parse(input_data.toString())
    let headers = extractHeaders(event.extensions.request.headers)
    let params = extractParams(event.extensions.request.query)

    if (!headers['x-programid'] ||!headers['channel'] || !params['cartId']) {
      let input_error = {
        status : 400,
        message : "BAD REQUEST",
        error : {
          message : "Please check input details"
        },
        code : "ERR005"
      }
      return input_error
    }

    /* Call Payment API */
    let payment_data = JSON.stringify(frontend_data)
    var payment_config = {
      method : 'post',
      url : 'http://orchestrator.pt-2-payment.tatadigital.com/orch/payment/status',
      headers : {
        "Content-Type" : "application/json"
      },
      data : payment_data
    }

    let frontend_response = axios(payment_config)
    .then(function(response) {
      /* Get Payment API response */
      let payment_response = response.data
      let payment_status = payment_response.order.status.toLowerCase()
      
      if (payment_status === "failed") {
        let failure_payment = {
          status : 500,
          message : "ERROR",
          error : {
            message : "Payment Failed"
          },
          code : "ERR006"
        }
        return failure_payment
      }
      else {
        /* Call fetchCart API */
        let cart_data = JSON.stringify({})
        var cart_config = {
          method : 'get',
          url : 'http://caas.pt-2-uc.tatadigital.com/carts/fetchCartDetails',
          headers : {
            "X-ProgramID" : headers['x-programid'],
            "customerId" : payment_response.order.custId,
            "Content-Type" : "application/json"
          },
          params : {
            "cartId" : params['cartId']
          },
          data : cart_data
        }

        /* Get Cart API response */
        let cart_response = axios(cart_config)
        .then(function (response) {
          let fetchCart_response = response.data
        
          let fetchCart_bundles = fetchCart_response.data.cart.bundles
          let reservation_details = frontend_data.reservationDetails
          let lineItems = []
          for (let i=0; i<fetchCart_bundles.length; i++) {
            let orderEntries = fetchCart_bundles[i].orderEntries
            for (let j=0; j<orderEntries.length; j++) {
              let product = {
                productId : orderEntries[j].productId
              }
              lineItems.push(product)
            }
          }

          for (let i=0; i<reservation_details.length; i++) {
            for (let j=0; j<lineItems.length; j++) {
              let product_skuId = lineItems[j].productId.split("_").pop()
              let reserv_skuId = reservation_details[i].reservationId.split("_")[1]
              if (product_skuId === reserv_skuId) {
                var warehouse = {"warehouse" : [reservation_details[i]]}
                lineItems[j] = Object.assign(lineItems[j], warehouse)
              }
            }
          }

          let promise_request = {
            promiseStock : {
              cartId : params['cartId'],
              programId : frontend_data.merchantId,
              customerHash : fetchCart_response.data.cart.customerId,
              lineItems : lineItems
            }
          }
          
          let promise_data = JSON.stringify(promise_request)
          var promise_config = {
            method : 'post',
            url : 'http://inventory.pt-2-uc.tatadigital.com/promise',
            headers : {
              "X-ProgramID" : headers['x-programid'],
              "Content-Type" : "application/json"
            },
            data : promise_data
          }

          let promise_response = axios(promise_config)
          .then(function (response) {
            let promise_response = response.data
            let promise_status = promise_response.status
            if (promise_status === 0) {
              return promise_response
            }
            else {
              let promise_line = promise_response.data.lineItems
              for (let i=0; i<promise_line.length; i++) {
                for (let j=0; j<fetchCart_bundles.length; j++) {
                  let order = fetchCart_bundles[j].orderEntries
                  for (let k=0; k<order.length; k++) {
                    if (promise_line[i].productId == order[k].productId) {
                      var warehouse = {"warehouse" : promise_line[i].warehouse}
                      order[k] = Object.assign(order[k],warehouse)
                    }
                  }
                }
              }
              }
              /* Delete CloneCart */
              let id = {
                cartId : fetchCart_response.data.cart._id
              }

              let deleteCartData = JSON.stringify(id)
              var deleteCart_config = {
                method : 'post',
                url : 'http://caas.pt-2-uc.tatadigital.com/carts/deleteCloneCart',
                headers : {
                  "X-ProgramID" : headers['x-programid'],
                  "customerId" : fetchCart_response.data.cart.customerId,
                  "Content-Type" : "application/json"
                },
                data : deleteCartData
              }

              let deleteCart_response = axios(deleteCart_config)
              .then(function (response) {
                let cart_response = response.data
                let deleteCart_status = cart_response.status
                if (deleteCart_status === 400) {
                  return cart_response
                }
                else {
                  /* Construct CreateOrder request */
                  let order_request = {
                    purchaseOrderNumber : fetchCart_response.data.cart.code,
                    customerHash : fetchCart_response.data.cart.customerId,
                    bundles : fetchCart_bundles,
                    paymentUsing : payment_response
                  }

                  /* Call CreateOrder API */
                  let order_data = JSON.stringify(order_request)
                  var order_config = {
                    method : 'post',
                    url : 'http://orders.pt-2-uc.tatadigital.com/order',
                    headers : {
                      "X-ProgramID" : headers['x-programid'],
                      "Channel" : headers['channel'],
                      "Content-Type" : "application/json"
                    },
                    data : order_data
                  }

                  /* Get CreateOrder response */
                  let order_response = axios(order_config)
                  .then(function (response) {
                    return response.data
                  })
                  .catch(function (error) {
                    if (error) {
                      let order_error = {
                        status : 500,
                        message : "ERROR",
                        error : {
                          message : "Please check order details"
                        },
                        code : "ERR003"
                      }
                      return order_error
                    }
                  })
                  return order_response
                }
              })
              .catch(function (error) {
                let err = error
              })
              return deleteCart_response

          })
          .catch(function(error) {
            // return error
            if (error) {
              let promise_error = {
                status : 500,
                message : "ERROR",
                error : {
                  message : "Please check promise details"
                },
                code : "ERR004"
              }
              return promise_error
            }
          })
          return promise_response
       
        })
        .catch(function (error) {
          if (error) {
            let cart_error = {
              status : 500,
              message : "ERROR",
              error : {
                message : "Please check cart details"
              },
              code : "ERR002"
            }
            return cart_error
          }
        })
        return cart_response
      }

    })
    .catch(function (error) {
      if (error) {
        let payment_error = {
          status : 500,
          message : "ERROR",
          error : {
            message : "Please check payment details"
          },
          code : "ERR001"
        }
        return payment_error
      }
    })
    return frontend_response
  }
}

/* Extract Headers */
function extractHeaders(headers) {
  let traceHeaders = ["x-programid", "channel"]
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
  let traceParams = ["cartId"]
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