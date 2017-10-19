interface HttpRequest {
  method: 'PUT' | 'POST' | 'DELETE' | 'GET'
  url: string
  headers?: object
  data?: object
}


export {
  HttpRequest as default,
  HttpRequest
}
