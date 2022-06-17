'use strict'

window.addEventListener('message', event => {
  if (event.data.jsonData !== undefined) {
    window.$ = window.json = event.data.jsonData
    console.log("JSON data is available in variable 'json'")
    console.log(window.json)
  }
})
