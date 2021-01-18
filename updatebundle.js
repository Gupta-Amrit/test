var axios = require('axios');

module.exports = {
    main: async function(event, context) {

        let requestBodyData = event.data;
        let headers = extarctHeaders(event.extensions.request.headers)

        if (!requestBodyData || !Object.keys(requestBodyData).length) {
            event.extensions.response.status(500);
            return 'ERROR';
        }

        let updateBundleEndPointURL = 'http://caas.dev-r2-uc.tatadigital.com/wipBundle/updateWipBundle';
        let updateBundleMethod = 'POST';


        var updateBundleConfig = {
            method: updateBundleMethod,
            url: updateBundleEndPointURL,
            headers: {
                'X-ProgramID': headers["x-programid"],
                'customerId': headers["customerid"],
                'Content-Type': headers["content-type"]
            },
            data: requestBodyData
        };

        let resoutput = axios(updateBundleConfig).then(function(updateBundleResponseBody) {

            let updateBundleMsgSuccess = updateBundleResponseBody.data.message;

            if (updateBundleMsgSuccess === "Success") {
                let updateBundleresponsedata = updateBundleResponseBody.data.data;

                let bundleId = updateBundleresponsedata.bundleId;
                let programId = updateBundleresponsedata.programId;
                let noOfProducts = updateBundleresponsedata.noOfProducts;
                let validateOffer = updateBundleresponsedata.validateOffer;


                let productcount = false;
                let arrUpdateBundleOrderEntries = updateBundleresponsedata.orderEntries;
                if (arrUpdateBundleOrderEntries.length > 0) {
                    productcount = true;
                }
                /* Validate Offer True Case */
                if (validateOffer == true) {


                    /* Authorization Code for API */
                    var phonePasswordData = JSON.stringify({
                        "phone": requestBodyData.phone,
                        "password": requestBodyData.password,
                        "codeChallenge": requestBodyData.codeChallenge,
                        "countryCode": requestBodyData.countryCode
                    })

                    let phonePasswordURL = 'https://dapi.tatadigital.com/api/v1/sso/login/phone-password';
                    let phonePasswordClientId = headers["client_id"];
                    let phonePasswordClientSecret = headers["client_secret"];
                    let phonePasswordContentType = headers["content-type"];



                    var phonePasswordConfig = {
                        method: 'POST',
                        url: phonePasswordURL,
                        headers: {
                            'client_id': phonePasswordClientId,
                            'client_secret': phonePasswordClientSecret,
                            'Content-Type': phonePasswordContentType
                        },
                        data: phonePasswordData
                    };


                    let phonePasswordresponseoutput = axios(phonePasswordConfig).then(function(phonePasswordResponse) {

                        let phonePasswordResponseData = phonePasswordResponse.data;
                        var phonePasswordResponseDataSuccessMsg = phonePasswordResponseData.success

                        /* PhonePassword API Response */
                        if (phonePasswordResponseDataSuccessMsg.trim() === "Authorization Code") {

                            var authCode = phonePasswordResponseData.authCode;

                            let authorizationClientId = headers["client_id"];
                            let authorizationClientSecret = headers["client_secret"];
                            let authorizationContentType = headers["content-type"];

                            /* Token generation from API */
                            let accessTokenRequestData = JSON.stringify({
                                "codeVerifier": "codeVerifier"
                            });
                            let Token_URL = 'https://dapi.tatadigital.com/api/v1/sso/access-token/' + authCode;

                            let accessTokenconfig = {
                                method: 'POST',
                                url: Token_URL,
                                headers: {
                                    'client_id': authorizationClientId,
                                    'client_secret': authorizationClientSecret,
                                    'Content-Type': authorizationContentType
                                },
                                data: accessTokenRequestData
                            };


                            let accessTokenResponse = axios(accessTokenconfig).then(function(accessTokenResponse) {

                                let tokenGenerationResponse = accessTokenResponse.data;
                                let accessToken = tokenGenerationResponse.accessToken;


                                let validateOfferClientId = headers["client_id"];
                                let validateOfferClientSecret = headers["client_secret"];
                                let validateOfferContentType = headers["content-type"];
                                let authorizationCode = 'Bearer ' + accessToken;



                                /* Validateoffer API */
                                let validateOfferRequestData = '{"basket":{"mode":"APPLY","channelName":"TCP","channelId":"TCPTDIN00001","programId":"01eac520-bc7a-1a10-8675-cf6516f1f134","applyOnlySelectedPromotions":true,"promotionIdsToBeApplied":["01eac520-bc7a-1a10-8675-cf6516f1f134:CROMA21"],"lineItem":[{"lineItemNumber":1,"itemId":"50031","quantity":1,"unitPrice":1000},{"lineItemNumber":2,"itemId":"50032","quantity":1,"unitPrice":10000}]}}';

                                let validateOfferconfig = {
                                    method: 'post',
                                    url: 'https://dapi.tatadigital.com/api/v1/offerValidation/validateOffers',
                                    headers: {
                                        'client_id': validateOfferClientId,
                                        'client_secret': validateOfferClientSecret,
                                        'Authorization': authorizationCode,
                                        'Content-Type': validateOfferContentType
                                    },
                                    data: validateOfferRequestData
                                };

                                let validateOfferResponseOutput = axios(validateOfferconfig).then(function(validateOfferApiResponse) {
                                    let validateOfferResponse = validateOfferApiResponse.data;

                                    console.log(JSON.parse(JSON.stringify(validateOfferResponse)));

                                    return validateOfferResponse;

                                }).catch(function(error) {

                                    let validateOfferError = {
                                        status: 500,
                                        message: "VALIDATEOFFER ERROR",
                                        error: {
                                            message: "validateOffer API errir"
                                        },
                                        code: "ERR005"
                                    }
                                    return validateOfferError;

                                });
                                /* Validateoffer API */


                                return validateOfferResponseOutput;


                                // return tokenGenerationResponse;


                            }).catch(function(error) {

                                let accessTokenError = {
                                    status: 500,
                                    message: "ACCESS TOKEN ERROR",
                                    error: {
                                        message: "accessToken API errors with Authorization Code"
                                    },
                                    code: "ERR004"
                                }
                                return accessTokenError;


                            });
                            /* Token generation from API */

                            return accessTokenResponse;




                        } else {

                            let phonePasswordAuthCodeError = {
                                status: 500,
                                message: "PHONEPASSWORD AUTHORIZATION CODE ERROR",
                                error: {
                                    message: "PhonePassword API errors with Authorization Code"
                                },
                                code: "ERR003"
                            }
                            return phonePasswordAuthCodeError;

                        }
                        /* PhonePassword API Response */




                        console.log(phonePasswordResponse.data)
                        return phonePasswordResponse.data;

                    }).catch(function(error) {
                        let phonePasswordError = {
                            status: 500,
                            message: "PHONEPASSWORD ERROR",
                            error: {
                                message: "Error in PhonePassword EndPoint API URL"
                            },
                            code: "ERR002"
                        }
                        return phonePasswordError

                    });


                    return phonePasswordresponseoutput;

                } else if (validateOffer == false && productcount == false) {

                    var deleteBunbdleRequestData = JSON.stringify({
                        "bundleId": deleteBundleResponse.data.data.bundleId
                    });

                    let deleteBundleEndPointURL = 'http://caas.dev-r2-uc.tatadigital.com/wipBundle/deleteWipBundle';
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

                        let deleteBundleError = {
                            status: 500,
                            message: "DELETEBUNDLE ERROR",
                            error: {
                                message: "No Success Message from DeleteBundle EndPoint URL"
                            },
                            code: "ERR006"
                        }
                        return deleteBundleError;

                    });


                    return deleteBundleResponseOutput;


                } else if (validateOffer == false && productcount == true) {
                    /* ValidateOffer is False and OrderEntries as Array of the Products */
                    return updateBundleResponseBody.data;

                }



            } else {

                let updateBundleError = {
                    status: 500,
                    message: "UPDATEBUNDLE ERROR",
                    error: {
                        message: "No Success Message from UpdateBundle EndPoint URL"
                    },
                    code: "ERR001"
                }

                return updateBundleError


            }




        }).catch(function(error) {

            let asyncFunctionError = {
                status: 500,
                message: "ASYNCFUNCTION ERROR",
                error: {
                    message: "Async Function error"
                },
                code: "ERR001"
            }
            return asyncFunctionError;

        });




        return resoutput;

    }
}


/* Extract Headers */
function extarctHeaders(headers) {
    const traceHeaders = ["x-programid", "customerid", "content-type", "client_id", "client_secret"]
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
