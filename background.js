'use strict'

/* global chrome */

const active = {}
const pending = {}

function addMenus () {
  chrome.contextMenus.create({
    contexts: ['link', 'page'],
    documentUrlPatterns: [],
    id: 'copyProperty',
    title: 'Copy property name'
  }, () => chrome.runtime.lastError)
  chrome.contextMenus.create({
    contexts: ['link', 'page'],
    documentUrlPatterns: [],
    id: 'copyValue',
    title: 'Copy value'
  }, () => chrome.runtime.lastError)
  chrome.contextMenus.create({
    contexts: ['link', 'page'],
    documentUrlPatterns: [],
    id: 'copyPath',
    title: 'Copy JSONPath location'
  }, () => chrome.runtime.lastError)
}

function updateMenus () {
  const urls = Object.values(active)
  const visible = urls.length > 0
  chrome.contextMenus.update('copyProperty', { documentUrlPatterns: urls, visible })
  chrome.contextMenus.update('copyValue', { documentUrlPatterns: urls, visible })
  chrome.contextMenus.update('copyPath', { documentUrlPatterns: urls, visible })
}

chrome.runtime.onInstalled.addListener(addMenus)

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.tabs.sendMessage(tab.id, { contextMenu: info.menuItemId })
})

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

function execute (tabId, url) {
  chrome.scripting.executeScript({
    files: ['page-script.js'],
    target: { tabId },
    world: 'MAIN'
  }, () => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js']
    }, results => {
      if (results && results[0]?.result) {
        active[tabId] = url
        updateMenus()
      } else {
        chrome.scripting.removeCSS({
          files: ['style.css'],
          target: { tabId: tabId }
        })    
      }
    })
  })
}

chrome.webNavigation.onCommitted.addListener(details => {
  if (details.parentFrameId !== -1) return
  if (pending[details.tabId] || /\.json(#|\?|$)/i.test(details.url)) {
    chrome.scripting.insertCSS({
      files: ['style.css'],
      target: { tabId: details.tabId }
    })
  }
})

chrome.webNavigation.onCompleted.addListener(details => {
  if (details.parentFrameId !== -1) return
  if (pending[details.tabId] || /\.json(#|\?|$)/i.test(details.url)) {
    delete pending[details.tabId]
    execute(details.tabId, details.url)
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
  chrome.scripting.insertCSS({
    files: ['style.css'],
    target: { tabId: tab.id }
  }, () => execute(tab.id, tab.url))
})
