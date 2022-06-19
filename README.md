# json-wrangler Chrome extension

This is a Chrome extension that makes it so JSON files are displayed in a much nicer and more interactive way in the browser. There already existed various extensions to do this, but they all suffered from being old and unmaintained, or buggy, or missing features I consider vital - or all of the above.

There are no options or configuration, just install the extension and then point your browser at a JSON file.

## Features

* It should automatically detect JSON files and handle them. If it fails to automatically detect a JSON file (almost certainly because the web server misidentified it) then you can click on the Extensions icon and choose "JSON Wrangler" to manually trigger the extension.
* If strings (including property names) are valid URLs then they will be made clickable.
* You can toggle arrays and objects open or closed by clicking on the arrows. When they are toggled closed the number of entries in the array or object are displayed.
* Hovering over an item shows the JOSNPath to that item as a tooltip.
* You can right-click on an item and the context menu offers options to copy the property name, the value, or the JSONPath to the clipboard.
* Ctrl-clicking on the arrows, rather than toggling the item you're clicking on instead opens or closes every item immediately contained within this one, which makes it very easy to see a list of the properties of an object, or the members of an array.
* Ctrl-clicking on an item closes the item that _contains_ that item. This makes it very easy to navigate to an item's container when dealing with large arrays and objects.
* Properties of objects are sorted by property name.
* There are colour schemes for dark & light mode.
* You can inspect the data at the JavaScript console by examining the global `json` object.
* Cut'n'pasting from the page should give you valid JSON.

## Notes

* Sometimes it won't trigger when it should; this appears to be due to a [Chrome bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1337294). If this happens, just hit Reload and it should work.

## Release history

### 1.1 (2022-06-19)

* Handle large files more gracefully.
* Support file: URLs by working around Chrome's `web_accessible_resources` bugginess.
* Various improvements and fixes.

### 1.0 (2022-06-17)

* Initial version.
* Tested on Chrome 102.
