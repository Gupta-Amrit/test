var axios = require('axios');


module.exports = { 
  main: async function (event, context) {    
   
     let requestBodyData = event.data;
     let headers = extarctHeaders(event.extensions.request.headers)

     if (!requestBodyData || !Object.keys(requestBodyData).length) {
            event.extensions.response.status(400);
            let requestBodyError = {
                status: 400,
                message: "REQUEST BODY ERROR",
                error: {
                    message: "Sorry, No Request Body is available in the API request"
                },
                code: "ERR001"
            }
            return requestBodyError;
     }

     if (!headers['x-programid'] || !headers['content-type'] ) {
        event.extensions.response.status(400);
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

	 
  let inventoryStatusEndPointURL = 'http://inventory.dev-r2-uc.tatadigital.com/inventory/status';  
  let inventoryStatusMethod      = 'POST';
   

	var inventoryStatusConfig = {
				  method: inventoryStatusMethod,
				  url: inventoryStatusEndPointURL,
				  headers: {
					'X-ProgramID': headers["x-programid"], 
					'Content-Type': headers["content-type"]
				  },
				  data : requestBodyData
    };
    

    var finalResponseData ={}
        finalResponseData['message'] = 'Success';
        finalResponseData['status']  = 1;
	var finalResponseData1 = {}
		
		

		 let inventoryResponseResultOutput = await axios(inventoryStatusConfig).then(function (inventoryStatusResponseBody) {      
				var inventoryStatusResponseData = inventoryStatusResponseBody.data;
				console.log("Inventory API ++++++++++++"+JSON.stringify(inventoryStatusResponseBody.data))
				return    inventoryStatusResponseData;	
			
			}).catch(function (error) {

				let inventoryStatusError = {
				  status : 500,
				  message : "INVENTORYSTATUS ERROR",
				  error : {
					message : "Inventory Status API error"
				  },
				  code : "ERR001"
				}				
			});
	
			console.log("inventoryResponseResultOutput ++++++++++"+JSON.stringify(inventoryResponseResultOutput))
			finalResponseData1['inventory'] = inventoryResponseResultOutput;
			
		
		let eddEndPointURL = 'http://caas-serviceability.dev-r2-uc.tatadigital.com/edd';  
		let eddMethod      = 'POST';
		
				
		var inventoryResponseResultOutputData = inventoryResponseResultOutput.data;
		
			var eddrequestBodyData = [];
		if(inventoryResponseResultOutputData){			
				if(inventoryResponseResultOutputData.length>0){
						 for (key in inventoryResponseResultOutputData) {
								if(inventoryResponseResultOutputData[key].storeWarehouseId){
														
									let inventoryRequestProductCode       =  requestBodyData.stockDetails[key].productId;
									let inventoryRequestStoreWareHouseIds =  requestBodyData.stockDetails[key].storeWareHouseIds
									let inventoryRequestChannel           =  requestBodyData.stockDetails[key].channel
									let inventoryRequestPincode           =  requestBodyData.stockDetails[key].pincode
									let inventoryRequestClassification    =  requestBodyData.stockDetails[key].classification
									let inventoryRequestProgramId         =  requestBodyData.stockDetails[key].programId
									let inventoryRequestOrderDate         =  requestBodyData.stockDetails[key].orderDate
									let inventoryRequestUserTimeZone      =  requestBodyData.stockDetails[key].userTimeZone					
									
								
									let inventoryResponseproductCode 		    = inventoryResponseResultOutputData[key]['productId'];
									let inventoryResponsestoreWarehouseId 	= inventoryResponseResultOutputData[key]['storeWarehouseId'];
									let inventoryResponsetotalAvailable 		= inventoryResponseResultOutputData[key]['totalAvailable'];
									let inventoryResponseinStockStatus 	  	= inventoryResponseResultOutputData[key]['inStockStatus'];
									
                 
									eddrequestBodyData1 = {"channel":inventoryRequestChannel,"pincode":inventoryRequestPincode,"classification":inventoryRequestClassification,"programId":inventoryRequestProgramId,"productId":inventoryRequestProductCode,"orderDate":inventoryRequestOrderDate,"userTimeZone":inventoryRequestUserTimeZone,"storeId":inventoryResponsestoreWarehouseId};					
									eddrequestBodyData.push(eddrequestBodyData1);

									}
					   }// end for				
					
				}
			
		}
		
	

		    
    var eddConfig = {
                        method: eddMethod,
                        url: eddEndPointURL,
                        headers: {
                         'X-ProgramID': headers["x-programid"], 
                         'Content-Type': headers["content-type"]
                        },
                        data : eddrequestBodyData
                  };				  
				  
		let eddResponseResultOutput = await axios(eddConfig).then(function (eddResponse) {
                    console.log("EDD response +++++"+JSON.stringify(eddResponse.data));                  
                    var eddResponseData = eddResponse.data;            
                
					return eddResponseData;

            }).catch(function (error) {

                    let eddError = {
                        status : 500,
                        message : "EDD ERROR",
                        error : {
                          message : "EDD API error"
                        },
                        code : "ERR002",
                        error1: error
                      }
                      
                      return eddError;

            }); 

			
		
		console.log("eddResponseResultOutput ++++++++++"+JSON.stringify(eddResponseResultOutput))
		finalResponseData1['edd'] = eddResponseResultOutput;
		
		console.log("FINAL RESPONSE ++++++++"+finalResponseData)
		finalResponseData['data'] = finalResponseData1;
		return finalResponseData;

  }
}


/* Extract Headers */
 function extarctHeaders(headers) {
      const traceHeaders = ["x-programid","content-type"]
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
/* Extract Headers */
