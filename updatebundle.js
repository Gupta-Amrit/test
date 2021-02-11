var axios = require('axios');

const updateBundleBaseURL = 'http://caas.dev-r2-uc.tatadigital.com';
const validateOfferBaseURL = 'http://promotions.dev-offer.tatadigital.com/rest/offers/validateOffers';

module.exports = {
    main: async function(event, context) {

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

    if (!headers['x-programid'] || !headers['content-type'] || !headers['customerid']) {
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

        /* Request Body parse */
        let bundleId = requestBodyData.bundleId;
        let programId = requestBodyData.programId;
        let noOfProducts = requestBodyData.noOfProducts;
        let validateOffer = requestBodyData.validateOffer;
        let channelId = requestBodyData.channelId;
        let productcount = false;
        var validateOfferRequestData;
        var arrUpdateBundleOrderEntries;




        /* orderEntries Array object */
        if (requestBodyData.orderEntries) {

            arrUpdateBundleOrderEntries = requestBodyData.orderEntries;
            if (arrUpdateBundleOrderEntries.length > 0) {
                productcount = true;
                var k = 1;
                var arr_lineitems = [];
                for (key in arrUpdateBundleOrderEntries) {
                    var productId = arrUpdateBundleOrderEntries[key]['productId'];
                    var productSkuId = arrUpdateBundleOrderEntries[key]['productSkuId'];
                    var unitPrice = arrUpdateBundleOrderEntries[key]['unitPrice'];
                    var basePrice = arrUpdateBundleOrderEntries[key]['basePrice'];
                    var quantity = arrUpdateBundleOrderEntries[key]['quantity'];
                    var deliveryAddress = arrUpdateBundleOrderEntries[key]['deliveryAddress'];
                   

                    var arr_lineitems1 = {
                        "lineItemNumber": k,
                        "itemId": productId,
                        "quantity": quantity,
                        "unitPrice": unitPrice
                    }
                    arr_lineitems.push(arr_lineitems1);
                    k++;
                }

                /* Validateoffer API */
                validateOfferRequestData = {
                    "basket": {
                        "mode": "APPLY",
                        "channelName": "TCP",
                        "channelId": channelId,
                        "programId": programId,
                        "applyOnlySelectedPromotions": true,
                        "promotionIdsToBeApplied": [bundleId],
                        "lineItem": arr_lineitems
                    }
                };


            } //Length of the OrderEntries        

        }
        /* orderEntries Array object */




        /* Validate Offer True Case */
        if (validateOffer == true && productcount ==true) {


            /* validateOffer API config values */            
            let validateOfferContentType = headers["content-type"];         

            


            let validateOfferMethod = "POST";
            let validateOfferEndPointURL = validateOfferBaseURL;

            let validateOfferconfig = {
                method: validateOfferMethod,
                url: validateOfferEndPointURL,
                headers: {
                    'Content-Type': validateOfferContentType
                },
                data: validateOfferRequestData
            };


            

            let validateOfferResponseOutput = axios(validateOfferconfig).then(function(validateOfferApiResponse) {
                                
               if(validateOfferApiResponse.data.basket.promotionSavingsSummary){               
                    var promotionSavingsSummary = validateOfferApiResponse.data.basket.promotionSavingsSummary.totalSavings.value;
               }else {
                    var promotionSavingsSummary = 0;
               }
              
                //if (promotionSavingsSummary) {

                    var updateBundleRequestBody = {}
                    updateBundleRequestBody['bundleId'] = bundleId;
                    updateBundleRequestBody['programId'] = programId;
                    updateBundleRequestBody['noOfProducts'] = noOfProducts;
                    updateBundleRequestBody['validateOffer'] = validateOffer;
                    updateBundleRequestBody['channelId'] = channelId;
                    updateBundleRequestBody['orderEntries'] = arrUpdateBundleOrderEntries;
                    updateBundleRequestBody['basket'] = {
                        "promotionSavingsSummary": promotionSavingsSummary
                    }

                    let updateBundleEndPointURL = updateBundleBaseURL + '/wipBundle/updateWipBundle';
                    let updateBundleMethod = 'POST';


                    var updateBundleConfig = {
                        method: updateBundleMethod,
                        url: updateBundleEndPointURL,
                        headers: {
                            'X-ProgramID': headers["x-programid"],
                            'customerId': headers["customerid"],
                            'Content-Type': headers["content-type"]
                        },
                        data: updateBundleRequestBody
                    };

                    let updateBundleResultOutput = axios(updateBundleConfig).then(function(updateBundleResponseBody) {
                        return updateBundleResponseBody.data

                    }).catch(function(error) {
							event.extensions.response.status(400);
                        let updateBundleError = {
                            status: 400,
                            message: "UPDATEBUNDLE ERROR",
                            error: {
                                message: "UpdateBundle API error"
                            },
                            code: "ERR001",
                            error1: error
                        }
                        return updateBundleError;

                    });

                    return updateBundleResultOutput;
                


            }).catch(function(error) {
                			
				//event.extensions.response.status(400);

                let validateOfferError = {
                    status: 400,
                    message: "VALIDATEOFFER ERROR",
                    error: {
                        message: "validateOffer API error"
                    },
                    code: "ERR002",
                    error2: error
                }
                return validateOfferError;

            });
            /* Validateoffer API */

            return validateOfferResponseOutput;


        } else if (validateOffer == false && productcount == false) {

            var deleteBunbdleRequestData = JSON.stringify({
                "bundleId": bundleId
            });

            let deleteBundleEndPointURL = updateBundleBaseURL + '/wipBundle/deleteWipBundle';
            let deleteBundleMethod = 'POST';


            let deleteBundleProgramId = headers["x-programid"];
            let deleteBundleCustomerId = headers["customerid"];
            let deleteBundleContentType = headers["content-type"];

            var deleteBundleconfig = {
                method: deleteBundleMethod,
                url: deleteBundleEndPointURL,
                headers: {
                    'X-ProgramID': deleteBundleProgramId,
                    'customerId': deleteBundleCustomerId,
                    'Content-Type': deleteBundleContentType
                },
                data: deleteBunbdleRequestData
            };


            let deleteBundleResponseOutput = axios(deleteBundleconfig).then(function(deleteBundleResponse) {

                let deleteBundleResponseData = deleteBundleResponse.data;
                return deleteBundleResponseData;

            }).catch(function(error) {
				event.extensions.response.status(400);

                let deleteBundleError = {
                    status: 400,
                    message: "DELETEBUNDLE ERROR",
                    error: {
                        message: "DeleteBundle API Error"
                    },
                    code: "ERR003",
                    error3: error
                }
                return deleteBundleError;

            });

            return deleteBundleResponseOutput;

        } else if (validateOffer == false && productcount == true) {


            var updateBundleRequestBody = {}
            updateBundleRequestBody['bundleId'] = bundleId;
            updateBundleRequestBody['programId'] = programId;
            updateBundleRequestBody['noOfProducts'] = noOfProducts;
            updateBundleRequestBody['validateOffer'] = validateOffer;
            updateBundleRequestBody['channelId'] = channelId;
            updateBundleRequestBody['orderEntries'] = arrUpdateBundleOrderEntries;
            updateBundleRequestBody['basket'] = {
                "promotionSavingsSummary": 0
            }




            let updateBundleEndPointURL = updateBundleBaseURL + '/wipBundle/updateWipBundle';
            let updateBundleMethod = 'POST';



            var updateBundleConfig = {
                method: updateBundleMethod,
                url: updateBundleEndPointURL,
                headers: {
                    'X-ProgramID': headers["x-programid"],
                    'customerId': headers["customerid"],
                    'Content-Type': headers["content-type"]
                },
                data: updateBundleRequestBody
            };

            let updateBundleResultOutput = axios(updateBundleConfig).then(function(updateBundleResponseBody) {
                return updateBundleResponseBody.data;

            }).catch(function(error) {
				event.extensions.response.status(400);

                let updateBundleError = {
                    status: 400,
                    message: "UPDATEBUNDLE with VALIDATEOFFER FALSE ERROR",
                    error: {
                        message: "UpdateBundle with ValidateOffer is False API"
                    },
                    code: "ERR001"
                }
                return updateBundleError;

            });

            return updateBundleResultOutput;

        }else {
			event.extensions.response.status(400);			
			let updateBundleError = {
                    status: 400,
                    message: "UPDATEBUNDLE with REQUIRED ORDERENTRIES",
                    error: {
                        message: "UpdateBundle with required OrderEntries Values"
                    },
                    code: "ERR001"
                }
                return updateBundleError;			
			
		}
        /* Condition of the Validateoffer flag */

    }
}


/* Extract Headers */
function extarctHeaders(headers) {
    const traceHeaders = ["x-programid", "customerid", "content-type"]
    var header_map = {}
    for (let h in traceHeaders) {
        var headerName = traceHeaders[h]
        var headerVal = headers[headerName]
        if (headerVal !== undefined) {
            header_map[headerName] = headerVal
        }

    }
    return header_map
}

/* Extract Headers */
