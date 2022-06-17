'use strict'

/* global chrome */

const pending = {}
const active = {}

chrome.contextMenus.create({
  contexts: ['link', 'page'],
  documentUrlPatterns: [],
  id: 'copyProperty',
  title: 'Copy property name'
})
chrome.contextMenus.create({
  contexts: ['link', 'page'],
  documentUrlPatterns: [],
  id: 'copyValue',
  title: 'Copy value'
})
chrome.contextMenus.create({
  contexts: ['link', 'page'],
  documentUrlPatterns: [],
  id: 'copyPath',
  title: 'Copy JSONPath location'
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.tabs.sendMessage(tab.id, { contextMenu: info.menuItemId })
})

function updateMenus () {
  const urls = Object.values(active)
  const visible = urls.length > 0
  chrome.contextMenus.update('copyProperty', { documentUrlPatterns: urls, visible })
  chrome.contextMenus.update('copyValue', { documentUrlPatterns: urls, visible })
  chrome.contextMenus.update('copyPath', { documentUrlPatterns: urls, visible })
}

chrome.webRequest.onHeadersReceived.addListener(
  details => {
    if (details.tabId < 0) return
    if (!details.responseHeaders) return
    for (const header of details.responseHeaders) {
      if (header.name.toLowerCase() !== 'content-type') continue
      if (!header.value ||
        header.value.trim().toLowerCase().split(';')[0] !== 'application/json') {
        continue
      }
      pending[details.tabId] = true
      break
    }
  },
  {
    types: ['main_frame'],
    urls: ['*://*/*']
  },
  [
    'responseHeaders'
  ]
)

chrome.webNavigation.onErrorOccurred.addListener(details => {
  delete pending[details.tabId]
  delete active[details.tabId]
  updateMenus()
})

chrome.webNavigation.onCommitted.addListener(details => {
  delete active[details.tabId]
  updateMenus()
})

chrome.webNavigation.onCompleted.addListener(details => {
  if (pending[details.tabId]) {
    delete pending[details.tabId]
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['content-script.js']
    }, results => {
      if (results[0].result) {
        active[details.tabId] = details.url
        updateMenus()
      }
    })
  }
})

chrome.webNavigation.onTabReplaced.addListener(details => {
  delete active[details.replacedTabId]
  updateMenus()
})

chrome.tabs.onRemoved.addListener(tabId => {
  delete active[tabId]
  updateMenus()
})

chrome.action.onClicked.addListener(tab => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content-script.js']
  }, results => {
    if (results[0].result) {
      active[tab.id] = tab.url
      updateMenus()
    }
  })
})
