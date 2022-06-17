'use strict'

/* global chrome */

function isCompact (container) {
  const values = Object.values(container)
  if (values.length > 8) return false
  for (const value of values) {
    if (value !== null && typeof value === 'object') return false
  }
  if (JSON.stringify(container, null, 2).length > 60) return false
  return true
}

function nodeFromString (string, jsonify) {
  if (/^[a-z-]{3,10}:/i.test(string)) {
    try {
      new URL(string) // eslint-disable-line no-new
      const a = document.createElement('a')
      a.target = '_blank'
      a.href = string
      a.textContent = jsonify ? JSON.stringify(string) : string
      return a
    } catch (err) {
    }
  }
  return document.createTextNode(jsonify ? JSON.stringify(string) : string)
}

function punctuation (string) {
  const span = document.createElement('span')
  span.classList.add(/[{}[\]]/.test(string) ? 'braces' : 'punctuation')
  span.textContent = string
  return span
}

function createTree (parent, value, path) {
  const type = value === null ? 'null' : typeof value
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'null') {
    const span = document.createElement('span')
    span.classList.add('value', type)
    span.append(type === 'string' ? nodeFromString(value, true) : JSON.stringify(value))
    span.title = path
    parent.append(span)
  } else if (Array.isArray(value)) {
    const compact = isCompact(value)
    parent.append(punctuation('['))
    if (!compact) {
      const fold = document.createElement('button')
      fold.type = 'button'
      fold.classList.add('fold')
      fold.dataset.length = value.length
      fold.textContent = '⯆'
      parent.append(fold)
    }
    const container = document.createElement(compact ? 'span' : 'div')
    container.classList.add('value', 'array')
    if (compact) container.classList.add('compact')
    let first = true
    for (let i = 0; i < value.length; i++) {
      if (!first) container.append(punctuation(','), compact ? ' ' : document.createElement('br'))
      createTree(container, value[i], `${path}[${i}]`)
      first = false
    }
    parent.append(container, punctuation(']'))
  } else if (type === 'object') {
    const compact = isCompact(value)
    const container = document.createElement(compact ? 'span' : 'div')
    container.classList.add('value', 'object')
    if (compact) container.classList.add('compact')
    parent.append(punctuation('{'))
    const properties = Object.keys(value)
    properties.sort()
    if (!compact) {
      const fold = document.createElement('button')
      fold.type = 'button'
      fold.classList.add('fold')
      fold.dataset.length = properties.length
      fold.textContent = '⯆'
      parent.append(fold)
    }
    let first = true
    for (const property of properties) {
      if (!first) container.append(punctuation(','), compact ? ' ' : document.createElement('br'))
      const subpath = /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u.test(property)
        ? `${path}.${property}`
        : `${path}[${JSON.stringify(property)}]`
      const span = document.createElement('span')
      span.classList.add('property')
      const propNode = nodeFromString(property)
      span.append(propNode)
      span.title = subpath
      container.append(span, punctuation(': '))
      createTree(container, value[property], subpath)
      first = false
    }
    parent.append(container, punctuation('}'))
  }
}

function toggle (target, mouseY, alwaysScroll) {
  if (target.classList.contains('folded')) {
    target.textContent = '⯆'
    target.classList.remove('folded')
    target.nextElementSibling.classList.remove('folded')
  } else {
    target.textContent = '⯈' + target.dataset.length
    target.classList.add('folded')
    target.nextElementSibling.classList.add('folded')
  }
  if (mouseY !== false) {
    const targetY = target.getBoundingClientRect().top + window.scrollY
    if (alwaysScroll || targetY < window.scrollY ||
      targetY > window.scrollY + document.querySelector('html').clientHeight) {
      window.scroll({ top: targetY + (mouseY > 6 ? 6 - mouseY : 0) })
    }
  }
}

function handle () {
  if (document.body.childNodes.length !== 1) return false
  if (document.body.firstChild.tagName !== 'PRE') return false
  const data = JSON.parse(document.body.firstChild.textContent)
  const style = document.createElement('link')
  style.rel = 'stylesheet'
  style.href = chrome.runtime.getURL('style.css')
  document.body.firstChild.remove()
  style.addEventListener('load', () => {
    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('page-script.js')
    script.addEventListener('load', () => {
      window.postMessage({ jsonData: data }, '*')
      const div = document.createElement('div')
      div.classList.add('json')
      const darkMode = window.matchMedia('(prefers-color-scheme: dark)')
      if (darkMode.matches) div.classList.add('dark')
      darkMode.addEventListener('change', event => {
        if (event.matches) {
          div.classList.add('dark')
        } else {
          div.classList.remove('dark')
        }
      })
      createTree(div, data, '$')
      document.body.append(div)
    })
    document.head.append(script)
  })
  document.head.append(style)
  document.body.addEventListener('click', event => {
    const target = event.target
    if (target.tagName === 'BUTTON' && target.classList.contains('fold')) {
      event.preventDefault()
      if (event.ctrlKey) {
        let folded
        for (const element of target.nextElementSibling.children) {
          if (element.tagName === 'BUTTON' && element.classList.contains('fold')) {
            if (folded === undefined) {
              folded = element.classList.contains('folded')
            }
            if (element.classList.contains('folded') === folded) {
              toggle(element, false)
            }
          }
        }
      } else {
        toggle(target, event.clientY)
      }
    } else if (event.ctrlKey) {
      for (let element = target; element; element = element.parentElement) {
        if (element?.previousElementSibling?.classList.contains('fold')) {
          event.preventDefault()
          toggle(element.previousElementSibling, event.clientY, true)
          break
        }
      }
    }
  }, true)

  let contextItem

  document.body.addEventListener('contextmenu', event => {
    contextItem = event.target
  })

  chrome.runtime.onMessage.addListener(request => {
    if (request.contextMenu === 'copyProperty') {
      let target = contextItem
      if (target.tagName === 'A') target = target.parentElement
      while (target && !target.classList.contains('property')) {
        if (target.tagName === 'BR' ||
          target.tagName === 'DIV' ||
          target.textContent === ',') {
          return
        }
        target = target.previousElementSibling
      }
      if (!target) return
      navigator.clipboard.writeText(target.textContent)
    } else if (request.contextMenu === 'copyValue') {
      let target = contextItem
      if (target.tagName === 'A') target = target.parentElement
      while (target && !target.classList.contains('value')) {
        if (target.tagName === 'BR' ||
          target.tagName === 'DIV' ||
          target.textContent === ',') {
          return
        }
        target = target.nextElementSibling
      }
      if (!target) return
      if (target.classList.contains('string') ||
      target.classList.contains('number') ||
      target.classList.contains('boolean') ||
      target.classList.contains('null')) {
        const value = JSON.parse(target.textContent).toString()
        navigator.clipboard.writeText(value)
      }
    } else if (request.contextMenu === 'copyPath') {
      let target = contextItem
      if (target.tagName === 'A') target = target.parentElement
      while (target && !target.title) {
        if (target.tagName === 'BR' ||
          target.tagName === 'DIV' ||
          target.textContent === ',') {
          return
        }
        target = target.nextElementSibling
      }
      if (!target) return
      navigator.clipboard.writeText(target.title)
    }
  })
  return true
}

handle()
