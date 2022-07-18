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

function nodeFromString (string) {
  if (/^[a-z-]{3,10}:/i.test(string)) {
    try {
      new URL(string) // eslint-disable-line no-new
      const a = document.createElement('a')
      a.tabIndex = 0
      a.textContent = JSON.stringify(string)
      return a
    } catch (err) {
    }
  }
  return document.createTextNode(JSON.stringify(string))
}

function punctuation (string) {
  const span = document.createElement('span')
  span.classList.add(/[{}[\]]/.test(string) ? 'braces' : 'punctuation')
  span.textContent = string
  return span
}

function indent (depth) {
  const span = document.createElement('span')
  span.classList.add('indent')
  span.textContent = '  '.repeat(depth)
  return span
}

function sleep (timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

let count

async function createTree (parent, value, depth, arrayIndex) {
  if (++count > 1000) {
    count = 0
    await sleep(1)
  }
  const type = value === null ? 'null' : typeof value
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'null') {
    const span = document.createElement('span')
    if (arrayIndex !== undefined) span.dataset.index = arrayIndex
    span.classList.add('value', type)
    span.append(type === 'string' ? nodeFromString(value) : JSON.stringify(value))
    parent.append(span)
  } else if (Array.isArray(value)) {
    const compact = isCompact(value)
    const empty = value.length === 0
    parent.append(punctuation('['))
    if (arrayIndex !== undefined) parent.lastChild.dataset.index = arrayIndex
    if (compact) {
      if (!empty) parent.append(' ')
    } else {
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
      if (!compact) container.append(indent(depth + 1))
      await createTree(container, value[i], depth + 1, i)
      first = false
    }
    parent.append(container, empty ? '' : compact ? ' ' : indent(depth), punctuation(']'))
  } else if (type === 'object') {
    const compact = isCompact(value)
    const properties = Object.keys(value)
    const empty = properties.length === 0
    const container = document.createElement(compact ? 'span' : 'div')
    container.classList.add('value', 'object')
    if (compact) container.classList.add('compact')
    parent.append(punctuation('{'))
    if (arrayIndex !== undefined) parent.lastChild.dataset.index = arrayIndex
    properties.sort()
    if (compact) {
      if (!empty) parent.append(' ')
    } else {
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
      if (!compact) container.append(indent(depth + 1))
      const span = document.createElement('span')
      span.classList.add('property')
      const propNode = nodeFromString(property)
      span.append(propNode)
      container.append(span, punctuation(': '))
      await createTree(container, value[property], depth + 1)
      first = false
    }
    parent.append(container, empty ? '' : compact ? ' ' : indent(depth), punctuation('}'))
  }
}

function jsonPath (node) {
  if (node?.tagName === 'A') node = node.parentElement
  if (node?.tagName !== 'SPAN') return
  if (!node.classList.contains('property') && !node.classList.contains('value') &&
      !node.classList.contains('braces')) {
    return
  }
  const path = []
  while (true) {
    const parent = node.parentElement
    if (!parent || parent.classList.contains('json') || parent.tagName === 'BODY') break
    if (parent.classList.contains('object')) {
      while (node && !node.classList.contains('property')) node = node.previousElementSibling
      if (node) {
        const property = JSON.parse(node.textContent)
        path.unshift(/^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u.test(property)
          ? `.${property}`
          : `[${JSON.stringify(property)}]`
        )
      }
    } else if (parent.classList.contains('array')) {
     while (node && node.dataset?.index === undefined) node = node.previousElementSibling
     if (node) path.unshift(`[${node.dataset.index}]`)
    }
    node = parent
  }
  path.unshift('$')
  return path.join('')
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

async function handle () {
  if (document.body.childNodes.length !== 1) return false
  if (document.body.firstChild.tagName !== 'PRE') return false
  const data = JSON.parse(document.body.firstChild.textContent)
  document.body.classList.add('loading')
  await sleep(1)
  const div = document.createElement('div')
  div.classList.add('json')
  count = 0
  await createTree(div, data, 0)
  document.body.firstChild.remove()
  document.body.append(div)
  document.body.classList.remove('loading')
  setTimeout(() => window.postMessage({ jsonData: data }, '*'), 500)
  
  let downNode
  let downX
  let downY

  document.body.addEventListener('mousedown', event => {
    if (event.buttons === 1) {
      downNode = event.target
      downX = event.clientX
      downY = event.clientY
    } else {
      downNode = undefined
    }
  }, true)
  document.body.addEventListener('mouseup', event => {
    const target = event.target
    const diffX = event.clientX - downX
    const diffY = event.clientY - downY
    if (downNode !== target || diffX * diffX + diffY * diffY >= 25) return
    if (target.tagName === 'A') {
      event.preventDefault()
      window.open(JSON.parse(target.textContent), '_blank')
    } else if (target.tagName === 'BUTTON' && target.classList.contains('fold')) {
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

  const tooltip = document.createElement('span')
  tooltip.id = 'tooltip'
  div.append(tooltip)
  let tooltipNode
  let tooltipValue

  function updateTooltip (mouseX, mouseY, node) {
    if (node === tooltipNode) return
    tooltipNode = node
    const newValue = node ? jsonPath(node) : undefined
    if (tooltipValue !== newValue) {
      if (newValue == undefined) {
        tooltip.classList.remove('active')
      } else {
        if (tooltipValue === undefined) tooltip.classList.add('active')
        tooltip.textContent = newValue
      }
      tooltipValue = newValue
    }
  }

  document.body.addEventListener('pointermove', event => {
    updateTooltip(event.clientX, event.clientY, event.target)
  })
  document.addEventListener('scroll', () => updateTooltip())

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
      navigator.clipboard.writeText(JSON.parse(target.textContent))
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
      let path = jsonPath(contextItem)
      if (!path) return
      navigator.clipboard.writeText(path)
    }
  })
  return true
}

handle()
