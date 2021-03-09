const axios = require('axios')

module.exports = { 
  main: function (event, context) {
    let input_data = event.extensions.request.body
    let frontend_data = JSON.parse(input_data.toString())
    let headers = extractHeaders(event.extensions.request.headers)

    let token_info = {
      "key" : "jC7fy5fsELizsqBENF7ZrFMED",
      "secret" : "JrbM47xEsnoaNhec3E0ONKlumAGF9M6TM6hIA0yj"
    }

    let token_data = JSON.stringify(token_info)
    var token_config = {
      method : 'post',
      url : 'https://api.capillary.co.in/v3/oauth/token/generate',
      headers : {
        "Content-Type" : headers['content-type']
      },
      data : token_data
    }

    let token_response = axios(token_config)
    .then(function (response) {
      let token_response = response.data
      let access_token = token_response.data.accessToken
      
      let transaction_data = JSON.stringify(frontend_data)
      var transaction_config = {
        method : 'post',
        url : 'https://api.capillary.co.in/v2/transactions/bulk',
        headers : {
          "X-CAP-API-OAUTH-TOKEN" : access_token,
          "X-CAP-API-ATTRIBUTION-TILL-CODE" : "airasia.admin",
          "Accept" : "application/json",
          "Content-Type" : headers['content-type']
        },
        data : transaction_data
      }
      
      let transaction_response = axios(transaction_config)
      .then(function (response) {
        return response.data
      })
      .catch(function (error) {
        
        if (error) {
          let transaction_error = {
            status : 500,
            message : "ERROR",
            error : {
              message : "Please check transaction details"
            },
            code : "ERR002"
          }
          return transaction_error
        }
      })
      return transaction_response
    })
    .catch(function (error) {
      if (error) {
        let token_error = {
          status : 500,
          message : "ERROR",
          error : {
            message : "Please check token-generation details"
          },
          code : "ERR001"
        }
        return token_error
      }
    })
    return token_response
  }
}

function extractHeaders(headers) {
  let traceHeaders = ['content-type']
  let header_map = {}
  for (let h in traceHeaders) {
    let headerName = traceHeaders[h]
    let headerValue = headers[headerName]
    if (headerValue !== undefined) {
      header_map[headerName] = headerValue
    }
  }
  return header_map
}