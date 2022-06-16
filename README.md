# json-wrangler Chrome extension

This is a Chrome extension that makes it so JSON files are displayed in a much nicer and more interactive way in the browser. There already exist various extensions to do this, but they all suffered from being old and unmaintained, or buggy, or missing features I consider vital.

There are no options or configuration, just install the extension and then point your browser at a JSON file.

## Features

* If property names or strings are valid URLs then they will be made clickable.
* You can toggle arrays and objects open or closed by clicking on the arrows. When they are toggled closed the number of entries in the array or object are displayed.
* Hovering over an item shows the JOSNPath to that item as a tooltip.
* You can right-click on an item and the context menu offers options to copy the property name, the value, or the JSONPath to the clipboard.
* Ctrl-clicking on the arrows, rather than toggling the item you're clicking on instead opens or closes every item immediately contained within this one, which makes it very easy to see a list of the properties of an object, or the members of an array.
* Ctrl-clicking on an item closes the item that _contains_ that item. This makes it very easy to navigate to an item's container when dealing with large arrays and objects.
* Colour schemes for dark & light mode.
* You can inspect the data at the JavaScript console by examining the global `json` object.

## Release history

### 1.0 (xxxx-xx-xx)

* Initial release.
* Tested on Chrome 102.
