# json-wrangler Chrome extension

This is a Chrome extension that makes it so JSON files are displayed in a much nicer and more interactive way in the browser. There already exist various extensions to do this, but they all suffered from being old and unmaintained, or buggy, or missing features I consider vital.

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
* Colour schemes for dark & light mode.
* You can inspect the data at the JavaScript console by examining the global `json` object.

## Notes

* Although in principle it should be able to, it can't process files loaded from `data:` or `file:` URLs. This appears to be due to Chrome bugs relating to "Manifest V3".

## Release history

### 1.0 (xxxx-xx-xx)

* Initial release.
* Tested on Chrome 102.
