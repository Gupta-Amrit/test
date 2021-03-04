// For UC-197    

const axios = require('axios')
var moment = require('moment')

module.exports = { 
  main: async function (event, context) {
    
    let frontend_data = event.data  //Data for CreateOrderapi

    let headers = extarctHeaders(event.extensions.request.headers)
    let params = extractParams(event.extensions.request.query) 

    /* Check for Headers */
    if (!headers['x-programid'] || !headers['customerid'] || !headers["content-type"] || headers["content-type"] != "application/json") { 
      event.extensions.response.status(400) 
      let header_error = {
        status : 400,
        message : "BAD REQUEST",
        error : {
          message : "Please check Headers input details",
          code : "ERR005"
        }
      }
      return header_error
    } 
  
    //Config data for GR API
    let config = {
      method: 'post',
      url: 'http://golden-record.pt-dataplatform.tatadigital.com/service/tdl-dp/v1/gr/fetch-customer',
      headers: { 
        'Content-Type': headers["content-type"],
      },
      data : frontend_data
    };

    const gr_output = axios(config)
    .then((response1) => {
     //return response1.data;
      var gr_response = response1.data;

      let firstName = gr_response.nameDetails.firstName
      let middleName = gr_response.nameDetails.middleName
      let lastName = gr_response.nameDetails.lastName
      let name = firstName + " " + lastName
      let phone = gr_response.primaryMobile.phoneNumber

     //Config data for CloneCartAPI   
     let config = {
       method : 'put',
       url : 'http://caas.pt-2-uc.tatadigital.com/carts/cloneCart',
       headers : {
        'Content-Type': headers["content-type"], 
        'X-ProgramID': headers["x-programid"], 
        'customerId': headers["customerid"]
       },
       params : {
          "cartId" : params['cartId']
       },
       data : JSON.stringify({ })
     }
      
     const clonecart_result = axios(config)
     .then((response2) => {
      //return response2.data
      var clonecartResponse = response2.data

      let lineItems = [], products = [], a=1;
      let cartId 			= clonecartResponse.data.cart._id
      let customerHash 	= clonecartResponse.data.cart.customerId
      let programId 		= clonecartResponse.data.cart.code
      let totalPrice = clonecartResponse.data.cart.totalPrice
      let subTotal = clonecartResponse.data.cart.subTotal

      var bundles 		= clonecartResponse.data.cart.bundles
      for(let i in bundles){
          var orderEntries = bundles[i]['orderEntries']
          for (let j in orderEntries) {
              let productID = orderEntries[j]['productId']
              let skuId = productID.split("_").pop()
              let quantity = orderEntries[j]['quantity']

              let totalPriceP = orderEntries[j]['totalPrice']
              let basePriceP = orderEntries[j]['basePrice']
              let itemDescription = orderEntries[j]['name']
              let address = orderEntries[j]['deliveryAddress']['addressLine3']

              let warehouseD = orderEntries[j]['storeIds']
              for(let a in warehouseD){
                warehouseD[a]={"warehouseId": warehouseD[a]}
              }

              let city= orderEntries[j]['deliveryAddress']['city']
              let country= orderEntries[j]['deliveryAddress']['country']['name']
              let mobilePhone= orderEntries[j]['deliveryAddress']['phone1']
              let zipCode= orderEntries[j]['deliveryAddress']['postalCode']
              let state= orderEntries[j]['deliveryAddress']['state']

              //Request Structure for reserve Api
              var shippingAddress = {
                  city: city,
                  country: country,
                  mobilePhone: mobilePhone,
                  zipCode: zipCode,
                  state: state
              }
              
              var bundledetails = 
              {
                  productId: productID,
                  qty: quantity,
                  warehouse: warehouseD,
                  shippingAddress: shippingAddress
              }
              var l1 = [bundledetails]
              lineItems.push(...l1)

              //Request Structure for createOrderForTcp API
              var productdetails = 
              {
                  itemId: a++,
                  skuId: skuId,
                  quantity: quantity,
                  itemDescription: itemDescription,
                  itemActualAmount: basePriceP,
                  itemPayableAmount: totalPriceP,
                  itemTotalAmount: totalPriceP * quantity,
                  deliveryAddress: address,
                  warehouse: warehouseD,
              }  
              var l2 = [productdetails]
              products.push(...l2)
          }     
      }
      
      var reserve_req = {
        reservationStock: {
          cartId: cartId,
          programId: programId,
          customerHash: customerHash,
          lineItems: lineItems
        }
      }//End of request structure for ReserveAPI

      let reserve_data = JSON.stringify(reserve_req); //Data for ReserveAPI config

      //Config data for ReserveAPI
      let config = {
        method : 'POST',
        url : 'http://inventory.pt-2-uc.tatadigital.com/reserve',
        headers: {
          'Content-Type': headers["content-type"], 
          'X-ProgramID': headers["x-programid"] 
        },
        data : reserve_data
      }

      const reserve_result = axios(config)
      .then((response3) => {
        //return response3.data
        var reserveResponse = response3.data
        
        for (let a in frontend_data.product){
            //if(frontend_data.product[a]["code"] == products[a]["skuId"])
              frontend_data.product[a] = Object.assign(products[a], frontend_data.product[a])
        }

        var created = moment().format('YYYY-MM-DD hh:mm:ss')

        var merchant = {
          "merchantOrderRef": programId,//params['cartId'],
          "merchantId": "UniversalCart", 
          "merchantName": "UniversalCart",
          "terminalId": "T035",
          "custName": name,
          "mobileNo": phone, 
          "typeOfRequest": "Payment",
          "orderDateTime": created,
          "custId": customerHash,
          "redirectEnabled": "true",
          "totalCartAmount": totalPrice,
          "updatedCartAmount": subTotal,
          "checkoutAmount": subTotal,
        }
    
        frontend_data = Object.assign(merchant, frontend_data)
        
        //Config data for CreateOrderAPI
        let config = {
          method : 'post',
          url: 'http://order.pt-2-payment.tatadigital.com/merchant/createOrderForTcp',
          headers: { 
            'Content-Type': headers["content-type"],
          },
          data : frontend_data
        }
        
        const createorder_result = axios(config)
        .then((response4) => {
          //return response4.data
          var createorderResponse=response4.data

          //Insert warehouse details from ReseverAPI to CreateOrderAPI response
          var warehouseResponse = []
          for(let i in reserveResponse.data.lineItems){
            let warehouseDetails = reserveResponse.data.lineItems[i]["warehouse"]
            warehouseResponse.push(warehouseDetails)
          }
          createorderResponse.cartId=params['cartId']  
          createorderResponse.productList.map((element,j) =>{
            element.warehouseDetails = warehouseResponse[j];
          });  //end of warehousedetails insertion

          return createorderResponse
        })

        .catch((error4) => {
          //return error4
          if (error4) {
            event.extensions.response.status(400)
            let createorder_error = {
              status : 400,
              message : "CreateOrderError",
              error : {
                message : "Please check CreateOrder Request structure",
                code : "ERR004"
              }
            }
            return createorder_error
          }
        })
        return createorder_result   // End of CreateOrderAPI 
      })

      .catch((error3) => {
        //return error3
        if (error3) {
            event.extensions.response.status(400)
            let reserve_error = {
              status : 400,
              message : "ReservationError",
              error : {
                message : "Please check Reserve Request Details",
                code : "ERR003"
              }
            }
            return reserve_error
          }
      })
      return reserve_result         // End of ReserveAPI  
     })

     .catch((error2) => {
      //return error2
      if(error2){
        event.extensions.response.status(400)
        let clonecart_error = {
          status: 400,
          message: "BAD_REQUEST",
          error: {
            message: "Cart is already CLONED or Cart not available",
            code: "ERR002"
          }
        }
        return clonecart_error
      }
     })    
     return clonecart_result          // End of CloneCartAPI 
   })

   .catch((error1) => {
   //return error1
    if(error1){
      event.extensions.response.status(400)
      let gr_error = {
        status: 400,
        message: "BAD_REQUEST",
        error: {
          message: "CUSTOMER INFO is not present",
          code: "ERR001"
        }
      }
      return gr_error                   // End of GR API
    }
   });
   return gr_output 
   
  }
};
    //External fuction for headers
    function extarctHeaders(headers) {
      const traceHeaders = ["x-programid","customerid", "content-type"]
      var header_map = {}
      for (let h in traceHeaders) {
        var headerName = traceHeaders[h]
        var headerVal = headers[headerName]
        if(headerVal !== undefined) {
          header_map[headerName] = headerVal
        }        
      }
      return header_map
    }
    
    //External function for queryParams
    function extractParams(params) {
      const traceParams = ["cartId"]
      var param_map = {}
      for (let p in traceParams) {
        let paramName = traceParams[p]
        let paramVal = params[paramName]
        if (paramVal !== undefined) {
          param_map[paramName] = paramVal
        }
      }
      return param_map
    }
