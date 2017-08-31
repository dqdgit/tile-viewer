
const {ipcRenderer} = require('electron')
const path = require('path')
const { URL } = require('url')
let $ = require('jquery')

/**
 * Namespaces used in SVG XML documents.
 */
const SVG_NS = "http://www.w3.org/2000/svg"
const SVG_DC_NS = "http://purl.org/dc/elements/1.1/"
const SVG_RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
const SVG_CC_NS = "http://creativecommons.org/ns#"

let shownXML

/**
 * Return the value of the specified element in given node's sub-tree. Return
 * an empty string if it's not found.
 * 
 * @param {Node} node - starting node
 * @param {String} namespace - url of the namespace to use
 * @param {String} element - name of the element to search for
 */
function getValue(node, namespace, element) {
  if (node.getElementsByTagNameNS(namespace, element).length > 0) {
    return node.getElementsByTagNameNS(namespace, element)[0].childNodes[0].nodeValue;
  } else {
    return "";
  }
}

/**
 * Return the value of the specified element having the specified parent in the given 
 * node's subtree. Return an empty string if it's not found.
 * 
 * @param {Node} node - starting node
 * @param {String} namespace - url of the namespace to use
 * @param {String} parent - name of the parent element
 * @param {String} chile - name of the child element
 */
function getChildValue(node, namespace, parent, child) {
  if (node.getElementsByTagNameNS(namespace, parent).length > 0) {
    let parentNode = node.getElementsByTagNameNS(namespace, parent)[0];
    return getValue(parentNode, namespace, child);
  } else {
    return "";
  }
}

/**
 * Return a string of keywords if found otherwise return an empty
 * string.
 * 
 * @param {Node} node - starting node
 */
function getKeywords(node) {
  let keywords = "";

  if (node.getElementsByTagNameNS(SVG_DC_NS, "subject").length > 0) {
    let subjectNode = node.getElementsByTagNameNS(SVG_DC_NS, "subject")[0];
    let keywordNodes = subjectNode.getElementsByTagNameNS(SVG_RDF_NS, "li");
    for (let i = 0; i < keywordNodes.length; i++) {
      keywords = keywords + (i == 0 ? "" : ", ") + keywordNodes[i].textContent;
    }
  }

  return keywords;
}

/**
 * Return the XML document updated with the given keywords.
 * 
 * @param {Object} xmlDoc - the XML document containing the SVG content
 * @param {String} keywords - comma separated list of new keywords
 */
function updateKeywords(xmlDoc, keywords) {
  let metaNode = xmlDoc.getElementsByTagName("metadata")[0];

  // Determine if the subject node exists and has 
  // children if so remove it
  if (metaNode.getElementsByTagNameNS(SVG_DC_NS, "subject").length > 0) {
    let subjectNode = metaNode.getElementsByTagNameNS(SVG_DC_NS, "subject")[0];
    subjectNode.parentNode.removeChild(subjectNode);
  }

  // Rebuild the subject node with the new keywords
  let subjectNode = xmlDoc.createElementNS(SVG_DC_NS, "dc:subject");
  let bagNode = xmlDoc.createElementNS(SVG_RDF_NS, "rdf:Bag");
  subjectNode.appendChild(bagNode);

  keywords_array = keywords.split(",");
  for (let i = 0; i < keywords_array.length; i++) {
    let liNode = xmlDoc.createElementNS(SVG_RDF_NS, "rdf:li");
    liNode.textContent = keywords_array[i].trim();
    bagNode.appendChild(liNode);
  }

  // Append the new subject tree to the metadata node
  let workNode = metaNode.getElementsByTagNameNS(SVG_CC_NS, "Work")[0]
  workNode.appendChild(subjectNode)

  return xmlDoc;
}

/**
 * Return an object containing the tile metadata
 * 
 * @param {String} data - string containing SVG (tile) content
 */
function getTileMetaData(xmlDoc) {
  let metadata = {};

  let svgNode = xmlDoc.getElementsByTagName("svg")[0];
  metadata.viewbox = svgNode.getAttribute("viewBox");
  metadata.width = svgNode.getAttribute("width");
  metadata.height = svgNode.getAttribute("height");

  metadata.title = getValue(svgNode, SVG_NS, "title");

  // Parsing the SVG metadata is more difficult because it uses multiple
  // namespaces and is nested.
  let metaNode = xmlDoc.getElementsByTagName("metadata")[0];
  if (metaNode == undefined) {
    return metadata;
  }

  metadata.format = getValue(metaNode, SVG_DC_NS, "format");
  metadata.date = getValue(metaNode, SVG_DC_NS, "date");
  metadata.description = getValue(metaNode, SVG_DC_NS, "description");

  metadata.creator = getChildValue(metaNode, SVG_DC_NS, "creator", "title");
  metadata.publisher = getChildValue(metaNode, SVG_DC_NS, "publisher", "title");
  metadata.rights = getChildValue(metaNode, SVG_DC_NS, "rights", "title");
  metadata.keywords = getKeywords(metaNode);

  return metadata;
}

/**
 * Display the specified tile and it's metadata.
 * 
 * @param {String} idx - index of tile to display
 * @param {String} data - raw SVG file text
 * @param {String} fileUrl - URL of tile to display
 * @param {Object} fileStats - selected file system stats
 */
function showTile(idx, data, fileUrl, fileStats) {
  let parser = new DOMParser()
  let xmlDoc = parser.parseFromString(data, "text/xml")
  let metadata = getTileMetaData(xmlDoc)

  // SVG URL
  $("#svg_img").attr("src", fileUrl)

  // File system metadata
  let url = new URL(fileUrl)
  let filePath = url.pathname
  $("#file_name").text(path.basename(filePath))
  $("#file_path").text(path.resolve(path.format({dir: filePath})))

  $("#drive_created").text(fileStats.ctime)
  $("#drive_modified").text(fileStats.mtime)

  // SVG metadata
  $("#svg_title").text(metadata.title)
  $("#svg_viewbox").text(metadata.viewbox)
  $("#svg_width").text(metadata.width)
  $("#svg_height").text(metadata.height)
  $("#svg_date").text(metadata.date)
  $("#svg_creator").text(metadata.creator)
  $("#svg_rights").text(metadata.rights)
  $("#svg_publisher").text(metadata.publisher)
  $("#keywords_input").attr("data-value", metadata.keywords)
  $("#keywords_input").val(metadata.keywords)
  $("#keywords_input").attr("data-index", idx)

  shownXML = xmlDoc
}

/**
 * Display the specified SVG (tile) data and metadata.
 */
ipcRenderer.on('show-tile', (event, idx, data, fileUrl, fileStats) => {
  showTile(idx, data, fileUrl, JSON.parse(fileStats));
})

/**
 * Clear the display
 */
ipcRenderer.on('clear-tile', (event, fileUrl) => {
  $("#svg_img").attr("src", fileUrl)
  $(".svg-property-value").text("")
  $("#keywords_input").attr("data-value", "")
  $("#keywords_input").val("")
  $("#keywords_input").attr("data-index", "") 
  shownXML = null 
})

/**
 * 
 */
ipcRenderer.on('status-message', (event, message, area) => {
  var statusArea;
  switch(area) {
    case 'left':
      statusArea = $("#status_left")
      break;

    case 'middle':
      statusArea = $("#status_middle")
      break;

    case 'right':
      statusArea = $("#status_right")
      break;

    default:
      statusArea = $("#status-left")
  }

  statusArea.text(message)
})

/**
 * Click handler for the save keywords button. Update the keywords
 * in the current SVG document, serialize it and send it to the
 * server.
 */
$("#keywords_save").on("click", () => {
  let idx = $("#keywords_input").attr("data-index")

  if (shownXML && idx !== "") {
    let keywords = $("#keywords_input").val()
    let updatedDoc = updateKeywords(shownXML, keywords)
    let data = new XMLSerializer().serializeToString(updatedDoc)
    ipcRenderer.send('update-tile', idx, data)
  }
})

$("#keywords_cancel").on("click", () => {
  let idx = $("#keywords_input").attr("data-index")

  if (shownXML && idx !== "") {
    ipcRenderer.send('resend-tile', idx)
  }
})

/**
 * Keyboard handler for moving through the loaded tiles. The left
 * arrow key moves to the previous tile (if there is one). The right
 * arrow key moves to the next tile (if there is one).
 */
$(document).on('keyup', (event) => {
  let idx = $("#keywords_input").attr("data-index")
  // If no tile is loaded then the value of data-index 
  // will be the empty string (aka "")
  if (parseInt(idx) !== NaN) {
    if (event.keyCode == 37) {       // left arrow
      ipcRenderer.send('previous-tile', idx)
    } else if (event.keyCode == 39) {  // right arrow
      ipcRenderer.send('next-tile', idx)
    }
  }
})
