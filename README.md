# json-wrangler Chrome extension

This is a Chrome extension that makes it so JSON files are displayed in a much nicer and more interactive way in the browser. There already existed various extensions to do this, but they all suffered from being old and unmaintained, or buggy, or missing features I consider vital - or all of the above. In particular they could not cope at all with large files, which this extension can.

There are no options or configuration, just install the extension and then point your browser at a JSON file.

## Features

* It should automatically detect JSON files and handle them. If it fails to automatically detect a JSON file (almost certainly because the web server misidentified it) then you can click on the Extensions icon and choose "JSON Wrangler" to manually trigger the extension.
* If strings (including property names) are valid URLs then they will be made clickable.
* You can toggle arrays and objects open or closed by clicking on the '-' or '+'. When they are toggled closed the number of entries in the array or object are displayed.
* Very small (or empty) arrays and objects are displayed as a 1-line compact representation.
* Pressing Ctrl-F (Command-F on MacOS) opens a custom search box to allow you to search the file. It will find results inside folded sections, and when you move to those matches the necessary sections will be unfolded to display them. The search box also supports regular expression searches - just type a JavaScript regular expression (i.e. starting and ending with `/`). Text search is case insensitive, except regular expression searches which are case sensitive unless you append the `i` flag to the expression.
* Hovering over an item shows the JSONPath to that item in the status bar.
* You can right-click on an item and the context menu offers options to copy the property name, the value, or the JSONPath to the clipboard.
* Ctrl-clicking (Command-clicking on MacOS) on the '-' or '+' will, rather than toggling the item you're clicking on, instead open or close every item immediately contained within this one, which makes it very easy to see a list of the properties of an object, or the members of an array.
* Ctrl-clicking (Command-clicking on MacOS) on an item closes the item that _contains_ that item. This makes it very easy to navigate to an item's container when dealing with large arrays and objects.
* Properties of objects are sorted by property name.
* There are colour schemes for dark & light mode.
* You can inspect the data at the JavaScript console by examining the global `json` object.
* Cut'n'pasting from the window should give you valid JSON.

## Notes

* Sometimes it won't trigger when it should; this appears to be due to a [Chrome bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1337294). If this happens, just hit Reload and it should work.

## Release history

### 1.4.4 (2024-01-23)

* Improve robustness in the face of Chrome changes and other extensions.
* Tested on Chrome 120.

### 1.4.3 (2023-02-06)

* Handle broken JSON files better (don't end up with an empty page).
* Make searching inside compact objects work better.
* Various minor UI improvements.

### 1.4.2 (2022-09-24)

* MacOS improvements: avoid arrow characters that are not available in the MacOS font, and allow the Command key instead of the Ctrl key.
* Support 'Copy value' when the value is an object or array.

### 1.4.1 (2022-09-13)

* Improve speed of search.
* First public release.

### 1.4 (2022-09-10)

* Make the search asynchronous and interruptible so you don't get stuck waiting for results for a partially-typed search.
* Minor bug fixes and improvements.

### 1.3 (2022-09-05)

* Major rewrite to dynamically create only the HTML elements required to display the part of the JSON file that is currently visible on the screen. This makes things much faster for medium-sized files, and makes it actually possible to display large files.
* As a consequence of the above, Chrome's standard 'find in the page' feature won't work, as most of the file does not actually exist as far as Chrome is concerned. Therefore the extension has implemented a custom 'find' feature, which also supports regular expressions.

### 1.2 (2022-07-18)

* Improve JSONPath tooltip and move to bottom of window.
* Avoid having to store the JSONPath on every element.

### 1.1 (2022-06-19)

* Handle large files more gracefully.
* Support file: URLs by working around Chrome's `web_accessible_resources` bugginess.
* Various improvements and fixes.

### 1.0 (2022-06-17)

* Initial version.
* Tested on Chrome 102.
