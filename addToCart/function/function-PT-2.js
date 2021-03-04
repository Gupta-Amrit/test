const axios = require('axios')

module.exports = { 
  main: async function (event, context) {
    /* Import Frontend Data */
    let input_data = event.extensions.request.body
    let frontend_data = JSON.parse(input_data.toString())
    let headers = extractHeaders(event.extensions.request.headers)
    let params = extractParams(event.extensions.request.query)
    
    /* Check for Headers */
    if (!headers['x-programid']) { 
      let input_error = {
        status : 400,
        message : "BAD REQUEST",
        error : {
          message : "Please check input details"
        },
        code : "ERR001"
      }
      return input_error
    }
    
    let frontend_bundles = frontend_data.bundles
    let stockDetails = []
    
    let edd_request = []
    for (let i in frontend_bundles) {
      let frontend_orderEntries = frontend_bundles[i].orderEntries
      for (let j in frontend_orderEntries) {
        let productId = frontend_orderEntries[j].productId
        let storeIds = frontend_orderEntries[j].storeIds
        let postalCode = frontend_orderEntries[j].deliveryAddress.postalCode
        
        let stockDetail = {
          productId : productId,
          storeWareHouseIds : storeIds
        }
        stockDetails.push(stockDetail)

        if (postalCode === null || postalCode === undefined || postalCode === "") {
          let pincode_error = {
            status : 400,
            message : "ERROR",
            error : {
              message : "Please provide proper Pincode"
            },
            code : "ERR002"
          }
          return pincode_error
        }

        let edd = {
          channel : frontend_orderEntries[j].channel,
          pincode : frontend_orderEntries[j].deliveryAddress.postalCode,
          classification : frontend_orderEntries[j].classification,
          programId : frontend_orderEntries[j].programId,
          productId : frontend_orderEntries[j].productId,
          orderDate : frontend_orderEntries[j].orderDate,
          userTimeZone : frontend_orderEntries[j].userTimeZone,
        }
        edd_request.push(edd)
      }
    }
    
    /* Call InventoryStatus API */
    let inventory_data = JSON.stringify({stockDetails})
    var inventory_config = {
      method : 'post',
      url : 'http://inventory.pt-2-uc.tatadigital.com/inventory/status',
      headers : {
        "X-ProgramID" : headers['x-programid'],
        "Content-Type" : "application/json"
      },
      data : inventory_data
    }

    let inventory_response = axios(inventory_config)
    .then(function (response) {
      /* Get Invantory response */
      let inventory_response = response.data
      
      if (inventory_response.code === "404") {
        return response.data
      }
      else {
        let inventory_response_data = inventory_response.data
        
        for (let k in inventory_response_data) {
        
          let required_response = {
            productId : inventory_response_data[k].productId,
            inStockStatus : false
          }
          
          /* Check for inventory availability */
          let check_stock = inventory_response_data.some(function (object, index) {
            if (object.inStockStatus === required_response.inStockStatus) {
              return true
            }
            return false
          })
           
          if (check_stock == true) {
            let missing_product = inventory_response_data.filter(function (object) {
              if (object.inStockStatus === required_response.inStockStatus) {
                return object
              }
            })
            
            for (let m in missing_product) {
              let missing_error = {
                status : 500,
                message : "ERROR",
                error : {
                  message : `Sorry! Inventory is not avilable for Product ${missing_product[m].productId}`
                },
                code : "ERR003"
                }
              return missing_error
            }
                  
          }
          
        }
        
        /* Construct ValidateOffer request body */
        let lineItem = []
        for (let i=0; i<frontend_bundles.length; i++) {
          let orderEntries = frontend_bundles[i].orderEntries
          for (let j=0; j<orderEntries.length; j++) {
            let lineitem = {
              lineItemNumber : j + 1,
              itemId : orderEntries[j].productId,
              quantity : orderEntries[j].quantity,
              // unitPrice : orderEntries[j].unitPrice
            }
            lineItem.push(lineitem)
          }
        }

        for (let i=0; i<lineItem.length; i++) {
          for (let j=0; j<frontend_bundles.length; j++) {
            let order = frontend_bundles[j].orderEntries
            for (let k=0; k<order.length; k++) {
              if (order[k].productId == lineItem[i].itemId) {
                var is_digital = order[k].isDigital
                
                if (is_digital == true) {
                  var digital_type = order[k].digitalType.toLowerCase()
                  if (digital_type === "insurance") {
                    let unitPrice = {"unitPrice" : 0}
                    lineItem[i] = Object.assign(lineItem[i],unitPrice)
                  }
                  else {
                    var unitPrice = {"unitPrice" : order[k].unitPrice}
                    lineItem[i] = Object.assign(lineItem[i],unitPrice)
                  }
                }
                else if (is_digital == false || is_digital == null) {
                  var unitPrice = {"unitPrice" : order[k].unitPrice}
                  lineItem[i] = Object.assign(lineItem[i],unitPrice)
                }
              }
            }
          }
        }
        
        let validate_datails = []
        for (let k=0; k<frontend_bundles.length; k++) {
          
            let validate_structure = {
              basket : {
                mode : "APPLY",
                channelName : "TCP",
                channelId : frontend_bundles[k].channelId,
                programId : frontend_bundles[k].bundleProgramId,
                applyOnlySelectedPromotions : true,
                promotionIdsToBeApplied : [frontend_bundles[k].bundleId],
                lineItem : lineItem
              }
            }
            validate_datails.push(validate_structure)
          
        }
        
        /* Call ValidateOffer API */
        for (let v=0; v<validate_datails.length; v++) {
          let validate_data = JSON.stringify(validate_datails[v])
          var validate_config = {
            method : 'post',
            url : 'http://promotions.pt-offer.tatadigital.com/rest/offers/validateOffers',
            headers : {
              "Content-Type" : "application/json"
            },
            data : validate_data
          }

          let validate_response = axios(validate_config)
          .then(function (response) {
            /* Get validateOffer response */
            let valid_response = response.data
            let lineItem = valid_response.basket.lineItem
            
            for (let p=0; p<lineItem.length; p++) {
              let promotionReward = lineItem[p].promotionReward
             
              if (promotionReward.length === 0) {
                
                for (let m=0; m<frontend_bundles.length; m++) {
                  let orderEntries = frontend_bundles[m].orderEntries
                  for (let n=0; n<orderEntries.length; n++) {
                    if (orderEntries[n].productId == lineItem[p].itemId) {
                      let discount = {"discountValuesInternal" : 0}
                      orderEntries[n] = Object.assign(orderEntries[n], discount)
                    }
                  }
                }
              }
              else {
                for (let q=0; q<promotionReward.length; q++) {
                  let unitItemRewards = promotionReward[q].unitItemRewards
                  for (let r=0; r<unitItemRewards.length; r++) {
                    // let rewardValue = unitItemRewards[r].rewardValue
                    for (let n=0; n<frontend_bundles.length; n++) {
                      let orderEntries = frontend_bundles[n].orderEntries
                      for (let s=0; s<orderEntries.length; s++) {
                        if (orderEntries[s].productId == lineItem[p].itemId) {
                          let reward = {"discountValuesInternal" : unitItemRewards[r].rewardValue}
                          orderEntries[s] = Object.assign(orderEntries[s], reward)
                        }
                      }
                    }
                  }
                }
              }
            }
            
            for (let i=0; i<inventory_response_data.length; i++) {
              for (let j=0; j<edd_request.length; j++) {
                if (edd_request[j].productId == inventory_response_data[i].productId) {
                  var storeIds = {"storeId" : inventory_response_data[i].storeWarehouseId}
                  edd_request[j] = Object.assign(edd_request[j], storeIds)
                }
              }
            }
            
            /* Call EDD API */
            let edd_data = JSON.stringify(edd_request)
            
            var edd_config = {
              method : 'post',
              url : 'http://caas-serviceability.pt-2-uc.tatadigital.com/edd',
              headers : {
                "X-ProgramID" : headers['x-programid'],
                "Content-Type" : "application/json"
              },
              data : edd_data
            }

            let edd_response = axios(edd_config)
            .then(function (response) {
              /* Get EDD response */
              let edd_response = response.data
              let edd_response_data = edd_response.data
              
              let overrideBundle = params['overrideBundle'] || "null"
              
              
              if (overrideBundle.toLowerCase() === "yes") {
                /* Call UpdateCart API */
                let updateCart_data = JSON.stringify(frontend_data)
                
                var updateCart_config = {
                  method : 'post',
                  url : 'http://caas.pt-2-uc.tatadigital.com/carts/updateCart',
                  headers : {
                    "X-ProgramID" : headers['x-programid'],
                    "customerId" : headers['customerid'],
                    "Content-Type" : "application/json"
                  },
                  data : updateCart_data
                }

                let updateCart_response = axios(updateCart_config)
                .then(function (response) {
                  /* Get UpdateCart response */
                  let updateCart_response = response.data
                  let updateCart_bundles = updateCart_response.data.cart.bundles
                 
                  for (let i=0; i<edd_response_data.length; i++) {
                    for (let j=0; j<updateCart_bundles.length; j++) {
                      let orderEntries = updateCart_bundles[j].orderEntries
                      for (let k=0; k<orderEntries.length; k++) {
                        if (orderEntries[k].productId == edd_response_data[i].productId) {
                          let date = {"expectedDeliveryDate" : edd_response_data[i].edd}
                          
                          orderEntries[k] = Object.assign(orderEntries[k], date)
                        }
                      }
                    }
                  }
                  
                  /* Final UpdateCart response */
                  let final_updateCart_response = {
                    status : updateCart_response.status,
                    message : updateCart_response.message,
                    data : {
                      cart : {
                        _id : updateCart_response.data.cart._id,
                        customerId : updateCart_response.data.cart.customerId,
                        code : updateCart_response.data.cart.code,
                        totalPrice : updateCart_response.data.cart.totalPrice,
                        totalDiscounts : updateCart_response.data.cart.totalDiscounts,
                        subTotal : updateCart_response.data.cart.subTotal,
                        bundles : updateCart_bundles
                      }
                    }
                  }
                  return final_updateCart_response
                })
                .catch(function (error) {
                  if (error.response.data.error.code === "ERR002") {
                    let updateBundle_error = {
                      status : 400,
                      message : "BAD REQUEST",
                      error : {
                        message : "Bundle Id is not present"
                      },
                      code : "ERR004"
                    }
                    return updateBundle_error
                  }
                  else if (error.response.data.error.code === "ERR011") {
                    let update_error = {
                      status : 400,
                      message : "BAD REQUEST",
                      error : {
                        message : "Required inputs are not present"
                      },
                      code : "ERR009"
                    }
                    return update_error
                  }
                })
                return updateCart_response
              }
              
              else if (overrideBundle === "null") {
                /* Call AddToCart API */
                let addToCart_data = JSON.stringify(frontend_data)
                
                var addToCart_config = {
                  method : 'post',
                  url : 'http://caas.pt-2-uc.tatadigital.com/carts/addToCart',
                  headers : {
                    "X-ProgramID" : headers['x-programid'],
                    "customerId" : headers['customerid'],
                    "Content-Type" : "application/json"
                  },
                  data : addToCart_data
                }

                let addToCart_response = axios(addToCart_config)
                .then(function (response) {
                  /* Get AddToCart response */
                  let addToCart_response = response.data
                  let addToCart_bundles = addToCart_response.data.cart.bundles
                  for (let i=0; i<edd_response_data.length; i++) {
                    for (let j=0; j<addToCart_bundles.length; j++) {
                      let orderEntries = addToCart_bundles[j].orderEntries
                      for (let k=0; k<orderEntries.length; k++) {
                        if (orderEntries[k].productId == edd_response_data[i].productId) {
                          let date = {"expectedDeliveryDate" : edd_response_data[i].edd}
                          orderEntries[k] = Object.assign(orderEntries[k], date)
                        }
                      }
                    }
                  }
                  
                  /* Final AddToCart response */
                  let final_addToCart_response = {
                    status : addToCart_response.status,
                    message : addToCart_response.message,
                    data : {
                      cart : {
                        _id : addToCart_response.data.cart._id,
                        customerId : addToCart_response.data.cart.customerId,
                        code : addToCart_response.data.cart.code,
                        totalPrice : addToCart_response.data.cart.totalPrice,
                        totalDiscounts : addToCart_response.data.cart.totalDiscounts,
                        subTotal : addToCart_response.data.cart.subTotal,
                        bundles : addToCart_bundles
                      }
                    }
                  }
                  return final_addToCart_response
                })
                .catch(function (error) {
                  if (error.response.data.error.code === "ERR006") {
                    let addBundle_error = {
                      status : 400,
                      message : "BAD REQUEST",
                      error : {
                        message : "Bundle is already available in the cart"
                      },
                      code : "ERR005"
                    }
                    return addBundle_error
                  }
                  else if (error.response.data.error.code === "ERR011") {
                    let addCart_error = {
                      status : 400,
                      message : "BAD REQUEST",
                      error : {
                        message : "Required inputs are not present"
                      },
                      code : "ERR009"
                    }
                    return addCart_error
                  }
                })
                return addToCart_response
              }
            })
            .catch(function (error) {
              if (error) {
                let edd_error = {
                  status : 500,
                  message : "ERROR",
                  error : {
                    message : "Please check edd details"
                  },
                  code : "ERR006"
                }
                return edd_error
              }
            })
            return edd_response
          })
          .catch(function (error) {
            if (error) {
              let vaidate_error = {
                status : 500,
                message : "ERROR",
                error : {
                  message : "Please check validateOffer details"
                },
                code : "ERR008"
              }
              return vaidate_error
            }
          })
          return validate_response
        } 
      }
    })
    .catch(function (error) {
      if (error) {
        let inventory_error = {
          status : 500,
          message : "ERROR",
          error : {
            message : "Please check inventory details"
          },
          code : "ERR007"
        }
        return inventory_error
      }
    })
    return inventory_response
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