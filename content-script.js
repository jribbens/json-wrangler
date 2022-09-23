'use strict'

/* global chrome */

const INDENT = '  '

let root
const lines = []
let folds = {}
let json
let results
const LINE = Symbol('line')
const FOLD = Symbol('fold')
let fontHeight = 8
let fontWidth = 8
let height
let width = 80

let cancelSearch
let executeSearch
let updateResults

function isCompact (container) {
  const values = Object.values(container)
  if (values.length > 8) return false
  for (const value of values) {
    if (value !== null && typeof value === 'object') return false
  }
  if (JSON.stringify(container, null, 2).length > 60) return false
  return true
}

function rows (characters) {
  // return the number of rows this many characters will take to display
  return Math.ceil(characters / width)
}

function rowToLine (row) {
  // convert a row number on the screen to a line in the lines array
  let line = 0
  let endFold = 0
  for (const fold in folds) {
    if (row <= 0 || fold >= line + row) break
    if (endFold < fold) {
      row -= fold - endFold
      line = endFold = folds[fold][0]
      row -= folds[fold][1]
    }
  }
  return Math.max(0, line + row)
}

function lineToRow (line, open) {
  // convert a line number in the lines array into a row number on the page
  // will return undefined if the line is not visible due to being folded
  //   unless 'open' is true in which case it will open all folds necessary
  //   for this line to be visible
  let folded = 0
  let endFold = -1
  let changed
  for (const fold in folds) {
    if (fold >= line) break
    if (endFold < fold) {
      endFold = folds[fold][0]
      if (endFold >= line) {
        if (!open) return undefined
        setFold(fold, false)
        changed = fold
        continue
      }
      folded += Math.min(line, endFold - folds[fold][1]) - fold
    }
  }
  if (changed !== undefined) {
    json.style.height = `${fontHeight * lineToRow(height)}px`
    destroyLinesExcept(0, changed)
    updateLines()
    updateResults(results)
  }
  return line - folded
}

function annotateData (value, parent, index, depth, line, last) {
  // fill in the 'lines' array
  if (line === undefined) {
    // this is the top-level invocation
    lines.length = 0
    depth = 0
    line = 0
    last = true
    root = [value]
    parent = root
    index = 0
  }
  // get length of indent and property name prefix if any
  const length = depth * INDENT.length +
    (typeof index === 'string' ? JSON.stringify(index).length + 2 : 0)
  if (value === null || typeof value !== 'object') {
    // atomic value
    lines[line] = {
      comma: !last,
      depth,
      index,
      length: length + JSON.stringify(value).length + (last ? 0 : 1),
      parent
    }
    return line + rows(lines[line].length)
  }
  // it's an array or an object
  const compact = isCompact(value)
  value[LINE] = line
  if (Array.isArray(value)) {
    if (compact) {
      // compact array
      lines[line] = {
        comma: !last,
        depth,
        index,
        length: value.reduce(
          (length, subvalue) => length + JSON.stringify(subvalue).length + 2,
          length + 1 + (last ? 0 : 1)
        ),
        parent
      }
    } else {
      // verbose array
      lines[line] = {
        depth,
        index,
        items: value.length,
        length: length + 1 + value.length.toString().length + (last ? 0 : 1),
        parent,
        symbol: '['
      }
      line += rows(lines[line].length)
      for (let i = 0; i < value.length; i++) {
        line = annotateData(
          value[i],
          value,
          i,
          depth + 1,
          line,
          i >= value.length - 1
        )
      }
      lines[line] = {
        comma: !last,
        depth,
        index,
        length: depth * INDENT.length + 1 + (last ? 0 : 1),
        parent,
        symbol: ']'
      }
    }
  } else {
    if (compact) {
      // compact object
      lines[line] = {
        comma: !last,
        depth,
        index,
        length: Object.keys(value).reduce(
          (length, subvalue) =>
            length + JSON.stringify(subvalue).length +
              JSON.stringify(value[subvalue]).length + 4,
          length + 3 + (last ? 0 : 1)
        ),
        parent
      }
    } else {
      // verbose object
      const properties = Object.keys(value)
      properties.sort()
      lines[line] = {
        depth,
        index,
        items: properties.length,
        length: length + 3 + properties.length.toString().length +
          (last ? 0 : 1),
        parent,
        symbol: '{'
      }
      line += rows(lines[line].length)
      for (let i = 0; i < properties.length; i++) {
        line = annotateData(
          value[properties[i]],
          value,
          properties[i],
          depth + 1,
          line,
          i >= properties.length - 1
        )
      }
      lines[line] = {
        comma: !last,
        depth,
        index,
        length: depth * INDENT.length + 1 + (last ? 0 : 1),
        parent,
        symbol: '}'
      }
    }
  }
  return line + rows(lines[line].length)
}

function createNode (container, value, cls) {
  let link
  if ((cls === 'property' || (typeof value === 'string' && !cls)) &&
      /^[a-z-]{3,10}:/i.test(value)) {
    try {
      new URL(value) // eslint-disable-line no-new
      link = true
    } catch {}
  }
  const node = document.createElement(link ? 'a' : 'span')
  node.classList.add(cls || (value === null ? 'null' : typeof value))
  if (link) node.tabIndex = 0
  if (!cls) node.classList.add('value')
  const text = (cls && cls !== 'property') ? value : JSON.stringify(value)
  let length = container.textContent.length
  if ((length > 0 && !(length % width)) ||
      (length % width) + text.length > width) {
    length %= width
    for (let pos = 0; pos < text.length; pos += width - length) {
      if (length === 0 || pos > 0) {
        node.append(document.createElement('br'))
        length = 0
      }
      node.append(text.substring(pos, pos + width - length))
    }
  } else {
    node.append(text)
  }
  container.append(node)
}

function updateLines () {
  // create all elements to render lines visible on the screen,
  // and delete all elements outside that range.
  const top = -json.getBoundingClientRect().top
  const start = Math.floor(top / fontHeight)
  const end = Math.ceil((top + window.innerHeight) / fontHeight)
  destroyLinesExcept(...createLines(rowToLine(start), rowToLine(end)))
}

function destroyLinesExcept (start, end) {
  // destroy elements except those in range (start, end]
  for (const node of Array.from(json.children)) {
    const line = parseInt(node.dataset.line, 10)
    if (!isNaN(line) && (line < start || line >= end)) {
      delete lines[line].node
      node.remove()
    }
  }
}

function createLines (start, end) {
  // create objects to render lines in range (start, end]
  while (start > 0 && !lines[start]) start--
  for (let row = start; row < end; row++) {
    const line = lines[row]
    if (line && !line.node) {
      const div = document.createElement('div')
      div.classList.add('line')
      if (results?.includes(row)) div.classList.add('match')
      div.dataset.line = row.toString()
      div.style.top = `${fontHeight * lineToRow(row)}px`
      if (line.depth) div.append(INDENT.repeat(line.depth))
      const value = line.parent && line.parent[line.index]
      if (line.symbol === ']' || line.symbol === '}') {
        createNode(div, line.symbol, 'braces')
      } else {
        if (typeof line.index === 'string') {
          createNode(div, line.index, 'property')
          createNode(div, ': ', 'punctuation')
        }
        if (line.symbol) {
          createNode(div, line.symbol, 'braces')
          const fold = document.createElement('button')
          fold.type = 'button'
          fold.dataset.length = line.items
          fold.classList.add('fold')
          if (folds[row]) {
            fold.textContent = '+' + line.items
            fold.classList.add('folded')
            div.append(fold)
            createNode(div, line.symbol === '[' ? ']' : '}', 'braces')
            if (lines[folds[row][0]].comma) createNode(div, ',', 'punctuation')
          } else {
            fold.textContent = '-'
            div.append(fold)
          }
        } else {
          if (value === null || typeof value !== 'object') {
            createNode(div, value, undefined)
          } else if (Array.isArray(value)) {
            if (value.length === 0) {
              createNode(div, '[]', 'braces')
            } else {
              createNode(div, '[', 'braces')
              let first = true
              for (const val of value) {
                if (!first) createNode(div, ', ', 'punctuation')
                createNode(div, val)
                first = false
              }
              createNode(div, ']', 'braces')
            }
          } else {
            const properties = Object.keys(value)
            if (properties.length === 0) {
              createNode(div, '{}', 'braces')
            } else {
              properties.sort()
              createNode(div, '{', 'braces')
              let first = true
              for (const property of properties) {
                const val = value[property]
                if (!first) createNode(div, ', ', 'punctuation')
                createNode(div, property, 'property')
                createNode(div, ': ', 'punctuation')
                createNode(div, val)
                first = false
              }
              createNode(div, '}', 'braces')
            }
          }
        }
      }
      if (line.comma) createNode(div, ',', 'punctuation')
      div.append('\n')
      line.node = div
      json.append(div)
    }
    if (folds[row]) row = folds[row][0]
  }
  return [start, end]
}

function jsonPath (node) {
  if (node?.parentElement?.dataset?.line === undefined) return
  let line = lines[parseInt(node.parentElement.dataset.line, 10)]
  const path = []
  while (line.parent !== root) {
    path.unshift(
      (typeof line.index !== 'string' ||
        !/^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u.test(line.index))
        ? `[${JSON.stringify(line.index)}]`
        : `.${line.index}`
    )
    line = lines[line.parent[LINE]]
  }
  path.unshift('$')
  return path.join('')
}

function setFold (line, fold) {
  if (fold) {
    const depth = lines[line].depth
    let end = line + 1
    while (end < lines.length - 1 && !(lines[end]?.depth <= depth)) end++
    let preserve = line + 1
    while (!lines[preserve]) preserve++
    folds[line] = [end, preserve - line - 1]
    lines[line].parent[lines[line].index][FOLD] = true
  } else {
    delete folds[line]
    delete lines[line].parent[lines[line].index][FOLD]
  }
}

function recalculateFolds () {
  folds = {}
  for (let num = 0; num < lines.length; num++) {
    const line = lines[num]
    if (!line || (line.symbol !== '[' && line.symbol !== '{')) continue
    const value = line.parent[line.index]
    if (value !== undefined && value !== null && value[FOLD]) setFold(num, true)
  }
}

function toggle (line, mouseY, alwaysScroll) {
  // toggle a fold on the specified line
  // if mouseY is specified and the target is off the screen then scroll to it
  // or if mouseY is specified and alwaysScroll is true then scroll to it
  setFold(
    line,
    !lines[line].parent[lines[line].index][FOLD]
  )
  json.style.height = `${fontHeight * lineToRow(height)}px`
  destroyLinesExcept(0, line)
  updateLines()
  updateResults(results)
  if (typeof mouseY === 'number') {
    const targetY = json.getBoundingClientRect().top +
      lineToRow(line) * fontHeight + window.scrollY
    if (alwaysScroll || targetY < window.scrollY ||
        targetY > window.scrollY + document.documentElement.clientHeight) {
      window.scrollTo({ top: targetY + (mouseY > 6 ? 6 - mouseY : 0) })
    }
  }
}

function getFontWidth () {
  const span = document.createElement('span')
  span.classList.add('json')
  span.style.setProperty('border-width', '0', 'important')
  span.style.setProperty('padding', '0', 'important')
  span.style.setProperty('visibility', 'hidden', 'important')
  span.textContent = 'W'
  document.body.append(span)
  const box = span.getBoundingClientRect()
  fontHeight = box.height
  fontWidth = box.width
  span.remove()
}

async function handle () {
  if (document.body.childNodes.length !== 1) return false
  if (document.body.firstChild.tagName !== 'PRE') return false
  const data = JSON.parse(document.body.firstChild.textContent)
  getFontWidth()
  json = document.createElement('div')
  json.classList.add('json')
  document.body.replaceChildren(json)
  width = Math.floor(document.body.clientWidth / fontWidth) - 1
  height = annotateData(data)
  recalculateFolds()
  json.style.height = `${fontHeight * lineToRow(height)}px`
  updateLines(json)
  document.body.classList.add('loaded')
  setTimeout(() => window.postMessage({ jsonData: data }, '*'), 500)

  let downNode
  let downX
  let downY

  document.addEventListener('scroll', updateLines)
  let pendingResize
  window.addEventListener('resize', event => {
    if (pendingResize) {
      clearTimeout(pendingResize)
      pendingResize = undefined
    }
    updateLines()
    const newWidth = Math.floor(document.body.clientWidth / fontWidth)
    if (newWidth !== width) {
      pendingResize = setTimeout(_ => {
        pendingResize = undefined
        width = newWidth
        destroyLinesExcept(0, 0)
        document.body.classList.remove('loaded')
        height = annotateData(data)
        recalculateFolds()
        json.style.height = `${fontHeight * lineToRow(height)}px`
        updateLines()
        document.body.classList.add('loaded')
        executeSearch()
      }, 100)
    }
  })
  json.addEventListener('click', event => {
    const target = event.target
    if (target.tagName === 'BUTTON' && target.classList.contains('fold')) {
      event.preventDefault()
      if (event.ctrlKey) {
        let folded
        const targetRow = parseInt(target.parentElement.dataset.line, 10)
        const depth = lines[targetRow].depth
        for (let row = targetRow + 1; row < lines.length; row++) {
          const line = lines[row]
          if (!line || line.depth > depth + 1) continue
          if (line.depth <= depth) break
          if (line.symbol === '[' || line.symbol === '{') {
            if (folded === undefined) folded = folds[row] === undefined
            setFold(row, folded)
          }
        }
        json.style.height = `${fontHeight * lineToRow(height)}px`
        destroyLinesExcept(0, targetRow)
        updateLines()
        updateResults(results)
      } else {
        const line = parseInt(target.parentElement.dataset.line, 10)
        toggle(line, event.clientY)
        if (lines[line].node) {
          const button = lines[line].node.querySelector('button.fold')
          if (button) button.focus()
        }
      }
    } else if (event.ctrlKey && (target.tagName !== 'BUTTON' ||
        !target.classList.contains('fold'))) {
      let element = target
      while (element && !element.classList.contains('line')) {
        element = element.parentElement
      }
      if (element) {
        toggle(
          lines[parseInt(element.dataset.line, 10)].parent[LINE],
          event.clientY,
          true
        )
      }
    }
  })
  json.addEventListener('mousedown', event => {
    if (event.buttons === 1) {
      downNode = event.target
      downX = event.clientX
      downY = event.clientY
    } else {
      downNode = undefined
    }
  }, true)
  json.addEventListener('mouseup', event => {
    const target = event.target
    if (target.tagName !== 'A') return
    const diffX = event.clientX - downX
    const diffY = event.clientY - downY
    if (downNode !== target || diffX * diffX + diffY * diffY >= 25) return
    event.preventDefault()
    window.open(JSON.parse(target.textContent), '_blank')
  }, true)

  function makeFindbox () {
    const findbox = document.createElement('div')
    findbox.id = 'findbox'
    const close = document.createElement('button')
    close.classList.add('close')
    close.ariaLabel = 'Close'
    close.type = 'button'
    close.textContent = '✖'
    const label = document.createElement('label')
    label.for = 'find'
    label.append('Search:')
    const input = document.createElement('input')
    input.type = 'text'
    input.id = 'find'
    const loader = document.createElement('span')
    loader.classList.add('loader')
    const resultsNode = document.createElement('span')
    resultsNode.classList.add('results')
    const upArrow = document.createElement('button')
    upArrow.ariaLabel = 'Previous match'
    upArrow.type = 'button'
    upArrow.textContent = '⮝'
    const downArrow = document.createElement('button')
    downArrow.ariaLabel = 'Next match'
    downArrow.type = 'button'
    downArrow.textContent = '⮟'
    findbox.append(
      label,
      ' ',
      input,
      ' ',
      upArrow,
      ' ',
      downArrow,
      ' ',
      loader,
      resultsNode,
      close
    )
    const findbar = document.createElement('div')
    findbar.id = 'findbar'
    document.body.append(findbar)

    function openFindbox () {
      findbox.classList.add('active')
      input.focus()
      input.select()
      document.body.style.paddingTop = `${findbox.clientHeight}px`
      executeSearch()
    }

    async function closeFindbox () {
      findbox.classList.remove('active')
      document.body.style.paddingTop = null
      await cancelSearch()
      updateResults(undefined)
    }

    let error
    let current

    updateResults = (newResults, reset) => {
      if (results !== newResults) {
        results = newResults
        if (reset || results === undefined || current >= results.length) {
          current = 0
        }
        for (const node of json.children) {
          const line = parseInt(node.dataset.line, 10)
          if (!isNaN(line)) {
            if (results?.includes(line)) {
              node.classList.add('match')
            } else {
              node.classList.remove('match')
            }
          }
        }
      }
      resultsNode.classList.remove('error')
      if (results?.length) {
        const realHeight = lineToRow(height)
        resultsNode.textContent = `${current} / ${results.length}`
        findbar.style.maxHeight = `${realHeight * fontHeight}px`
        const barHeight = findbar.clientHeight - 1
        const marks = []
        let start
        let end
        function makeMark () {
          if (start === undefined) return
          const mark = document.createElement('div')
          mark.classList.add('mark')
          mark.style.top = `${start}px`
          mark.style.height = `${end + 1 - start}px`
          marks.push(mark)
        }
        results.forEach(num => {
          const row = lineToRow(num)
          if (row === undefined) return
          const lineStart = Math.round((row / realHeight) * barHeight)
          const lineEnd = Math.round(
            ((row + Math.ceil(lines[num].length / width)) / realHeight) *
            barHeight)
          if (end >= lineStart - 1) {
            end = lineEnd
          } else {
            makeMark()
            start = lineStart
            end = lineEnd
          }
        })
        makeMark()
        findbar.replaceChildren(...marks)
      } else {
        resultsNode.textContent = error || (results ? 'No matches' : '')
        if (error) resultsNode.classList.add('error')
        findbar.replaceChildren()
      }
    }

    function showResult (num) {
      current = num + 1
      resultsNode.textContent = `${current} / ${results.length}`
      window.scrollTo({
        behavior: 'smooth',
        top: lineToRow(results[num], true) * fontHeight
      })
    }

    let searchStatus

    cancelSearch = async () => {
      if (searchStatus) {
        searchStatus = 'cancel'
        // eslint-disable-next-line no-unmodified-loop-condition
        while (searchStatus) await new Promise(resolve => setTimeout(resolve, 5))
      }
      findbox.classList.remove('searching')
    }

    executeSearch = async move => {
      if (!findbox.classList.contains('active')) return
      await cancelSearch()
      let search = input.value
      let regexp
      input.classList.remove('error', 'regexp')
      error = undefined
      if (!search) return updateResults(undefined)
      const match = /^\/(.+)\/([imsu]*)$/.exec(search)
      if (match) {
        input.classList.add('regexp')
        try {
          regexp = new RegExp(match[1], match[2])
        } catch (exc) {
          error = exc.message.replace(/^Invalid regular expression: /, '')
          const prefix = `/${match[1]}/: `
          if (error.startsWith(prefix)) error = error.substring(prefix.length)
          input.classList.add('error')
          updateResults(undefined)
          return
        }
      }
      const newResults = []
      search = search.toLowerCase()
      searchStatus = 'search'
      findbox.classList.add('searching')
      for (let num = 0; num < lines.length; num++) {
        if (!(num % 10000)) {
          if (searchStatus === 'cancel') {
            searchStatus = undefined
            findbox.classList.remove('searching')
            return
          }
          await new Promise(resolve => setTimeout(resolve, 1))
        }
        const line = lines[num]
        if (!line?.parent) continue
        if (line.symbol === ']' || line.symbol === '}') continue
        let value = line.symbol ? line.index : line.parent[line.index]
        if (typeof value === 'object') value = JSON.stringify(value)
        const property = !line.symbol && typeof line.index === 'string'
          ? line.index
          : ''
        if (regexp) {
          if (regexp.test(value) || (property && regexp.test(property))) {
            newResults.push(num)
          }
        } else {
          if (String(value).toLowerCase().indexOf(search) >= 0 ||
              (property && property.toLowerCase().indexOf(search) >= 0)) {
            newResults.push(num)
          }
        }
      }
      searchStatus = undefined
      findbox.classList.remove('searching')
      updateResults(newResults, move)
      if (move && results?.length) showResult(current)
    }

    let pendingFind
    input.addEventListener('input', _ => {
      if (pendingFind) clearTimeout(pendingFind)
      pendingFind = setTimeout(_ => {
        pendingFind = undefined
        executeSearch(true)
      }, 250)
    })

    close.addEventListener('click', closeFindbox)

    document.body.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        closeFindbox()
        return
      }
      if (event.ctrlKey && (event.key === 'F' || event.key === 'f')) {
        event.preventDefault()
        openFindbox()
      }
      if (event.key === 'Enter' && event.target.tagName === 'A' &&
          !event.target.hasAttribute('href')) {
        event.preventDefault()
        window.open(JSON.parse(event.target.textContent), '_blank')
      }
    })

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (results) showResult(current >= results.length ? 0 : current)
      }
    })

    upArrow.addEventListener('click', _ => {
      if (results) showResult(current > 1 ? current - 2 : results.length - 1)
    })
    downArrow.addEventListener('click', _ => {
      if (results) showResult(current >= results.length ? 0 : current)
    })

    return findbox
  }

  document.body.append(makeFindbox())

  const tooltip = document.createElement('span')
  tooltip.id = 'tooltip'
  json.append(tooltip)
  let tooltipNode
  let tooltipValue

  function updateTooltip (mouseX, mouseY, node) {
    if (node === tooltipNode) return
    tooltipNode = node
    const newValue = node ? jsonPath(node) : undefined
    if (tooltipValue !== newValue) {
      if (newValue === undefined) {
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
      while (target && !target.classList.contains('property')) {
        if (target.textContent === ', ') return
        target = target.previousElementSibling
      }
      if (!target) return
      navigator.clipboard.writeText(JSON.parse(target.textContent))
    } else if (request.contextMenu === 'copyValue') {
      let target = contextItem
      while (target && !target.classList.contains('value')) {
        if (target.textContent === ', ') return
        target = target.nextElementSibling
      }
      if (!target) return
      if (target.classList.contains('string') ||
          target.classList.contains('number') ||
          target.classList.contains('boolean') ||
          target.classList.contains('null')) {
        const value = String(JSON.parse(target.textContent))
        navigator.clipboard.writeText(value)
      }
    } else if (request.contextMenu === 'copyPath') {
      const path = jsonPath(contextItem)
      if (!path) return
      navigator.clipboard.writeText(path)
    }
  })
  return true
}

handle()
