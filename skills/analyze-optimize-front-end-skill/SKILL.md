---
name: analize-optimize-front-end-skill
description: Analizes a network trace and provides optimizations
argument-hint: The user uploads a network trace (.HAR file) this skill will analize it and will give performance improvements.
allowed-tools: Read
metadata:
  author: Joaquin Recio Huertas
  version: "0.01"
---

# Analize and optimize

Users will upload a network trace file (.HAR) in JSON format and then please give improvements based on the instruction section. 

# Instructions

First count the number of requests.

Now exclude the requests with the following patterns:
- library-preload.js
- messagebundle.properties
- library.css
- manifest.json
- fonts (.woff2)
- some icons or images
- some personalization requests
- component-preload.js
- OData requests

say the number of requests left.

Group the requests by URL. Display the groups.

Find file sap-ui-version.json embedded in the HAR file itself. Otherwise get this URL https://ui5.sap.com/resources/sap-ui-version.json. It is a json format. Get the list of all library names. They are located in property "libraries".

Match the groups with the library list considering dots "." equal to "/". Example of this: "sap.ui.fl" is equals to "sap/ui/fl".

Show a table with columns "Group", "Library", "Requests" and "Action" suggesting to add library dependencies to the application file manifest.json for those groups with more than 5 requests and hinting the same for groups between 2 and 4 (both inclusive) requests. Ignore the ones with just 1 request.

Now consider only the oData requests (without ending in ".js") and show a table with the following columns:
- Column name "Method" from property "log"."entries"."request"."method"
- Column name "Size" from property "log"."entries"."response"."content"."size" is in bytes, convert it to Kb
- Column name "Start" from property "log"."entries"."startedDateTime". Convert the first row to time 0,0s and calculate the rest relative to the first one.
- Column name "Duration" from property "log"."entries"."time".

Also show a waterfall table (1 char = 0.1 s · 10 chars/s) based on "Start" and "Duration" from previous table with precision of milliseconds.

Based on the waterfall, identify number of sequential round trips. Suggest that 2 should be the maximum number with some exceptions.
Ideas for improvements:
- Review the dependencies between the requests.
- Merge round trips.
- Keep the round trips but trigger some round trips earlier.
Exceptions:
- HEAD requests in OData V4.
- Workers requests from ObjectPages for section 3 or further, which are triggered by Fiori Elements.
- $metadata requests are cached in browser when running against ABAP backends but not against BTP. Caches resources have property "log"."entries"."timmings"."send" equals 0.