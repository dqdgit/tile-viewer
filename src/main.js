const { app, BrowserWindow, Menu, MenuItem, ipcMain, dialog, Tray } = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const svgfile = require('./svgfile')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let tiles = []
let contents

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Open File...',
        click(item, focusWindow, event) {
          selectFiles();
        }
      },
      {
        label: 'Open Folder...',
        click(item, focusWindow, event) {
          selectFolders();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Close all',
        click(item, focusWindow, event) {
          clearTiles()
        }
      },
      {
        type: 'separator'
      },
      {
        role: 'quit'
      }
    ]
  }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

/**
 * 
 */
function createWindow() {
  // Create the browser window.
  // Platform: process.platform
  //   o "darwin" - Mac
  //   o "win32" - Windows
  //   o "linux" - Linux

  //const appIcon = new Tray(path.join(__dirname, 's-2-48.png'))

  win = new BrowserWindow({ 
    width: 800, 
    height: 500,
    title: "Tile Viewer",
    icon: path.join(__dirname, 'assets/s-2-48.png')
  })

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  //win.webContents.openDevTools()

  /**
   * Emitted when the window is closed.
   */
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })

  contents = win.webContents
}

/**
 * This method will be called when Electron has finished
 * initialization and is ready to create browser windows.
 * Some APIs can only be used after this event occurs.
 */
app.on('ready', createWindow)

/**
 * Quit when all windows are closed.
 *
 * On macOS it is common for applications and their menu bar
 * to stay active until the user quits explicitly with Cmd + Q
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * On macOS it's common to re-create a window in the app when the
 * dock icon is clicked and there are no other windows open.
 */
app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})

/**
 * Load and append the given list of the tile file paths to the tiles
 * array.
 * 
 * @param {Array} filePaths - a list of file path strings
 */
function loadTiles(filePaths) {
  for (let filePath of filePaths) {
    //console.log("file path: " + filePath);
    let svg = new svgfile(filePath);
    tiles.push(svg);
  }
}

/**
 * Tell the client to display the specified tile file and it's
 * associated metadata.
 * 
 * @param {Number} idx - the tiles index of the tile to display
 */
function showTile(idx) {
  let fileUrl = url.format({ pathname: tiles[idx].path, protocol: 'file:', slashes: true })
  let stats = fs.statSync(tiles[idx].path)
  let fileStats = {
    atime: stats.atime.toISOString(),
    mtime: stats.mtime.toISOString(),
    ctime: stats.ctime.toISOString()
  }
  contents.send('show-tile', idx, tiles[idx].data, fileUrl, JSON.stringify(fileStats))
}

/**
 * Reset the list of loaded tiles and client display.
 */
function clearTiles() {
  // Reset the array of tiles
  tiles = []

  // Create the URL for the default tile image
  let fileUrl = url.format({
    pathname: path.join(__dirname, 'assets/no-tile-loaded.svg'),
    protocol: 'file',
    slashes: true
  })
  
  // Send the clear all message to the client
  contents.send('clear-tile', fileUrl);
}

/**
 * Display the system open dialog and allow the user to select
 * zero or more SVG files to be loaded.
 */
function selectFiles() {
  dialog.showOpenDialog({filters: [{name: 'svg', extensions: ['svg']}],
                        properties: ['openFile', 'multiSelections']},
                        function (filePaths) {
    if (filePaths === undefined) {
      console.log("No files selected");
    } else {
      let numTiles = tiles.length
      loadTiles(filePaths);
      // If new tiles were added then update the display.
      // Always show the first tile in the set just loaded
      if (tiles.length > numTiles) {
        let idx = (numTiles > 0) ? numTiles : 0
        showTile(idx);
      } else {
        console.log("No tiles were added")
      }
    }
  });
}

/**
 * Return the list of SVG absolute file paths for the given folder and 
 * all it's sub-folders.
 * 
 * @param {String} dirPath - the directory path to search
 * @param {Array} filePaths - the current list of absolute file paths
 */
function getFilePaths(dirPath, filePaths) {
  let files = fs.readdirSync(dirPath)
  filePaths = filePaths || []

  for (let file of files) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      filePaths = getFilePaths(path.join(dirPath, file), filePaths)
    } else if (file.endsWith(".svg")) {
      filePaths.push(path.join(dirPath, file))
    }
  }

  return filePaths
}

/**
 * Display the system open dialog to allow the user to select
 * one or more folders and load all the SVG files found in
 * the specified folders.
 */
function selectFolders() {
  dialog.showOpenDialog({properties: ['openDirectory']},
    function (folderPaths) {
      if (folderPaths === undefined) {
        console.log("No folders selected");
      } else {
        console.log("folderPaths: " + folderPaths.length)
        let numTiles = tiles.length
        for (let folderPath of folderPaths) {
          let filePaths = getFilePaths(folderPath, null)
          loadTiles(filePaths)
        }

        // Only change the display if new tiles were added
        if (tiles.length > numTiles) {
          let idx = (numTiles > 0) ? numTiles : 0
          showTile(idx);
        } else {
          console.log("No tiles were added")
        }
      }
    });  
}

/**
 * Generic handler for client response message
 */
ipcMain.on('client-response', (event, arg) => {
  console.log("client-response: " + arg);
})

/**
 * Message handler to write changes to the specified tile to the 
 * file system.
 */
ipcMain.on('update-tile', (event, idx, data) => {
  idx = parseInt(idx)

  if (idx >= 0 && idx < tiles.length) {
    let tile = tiles[idx]
    try {
      fs.writeFileSync(tile.path, data, {encoding: 'utf8'})
      tile.data = data
    } catch (err) {
      console.log('ERROR: ' + err)
    }
  }
})

/**
 * Message handler to display the previous tile in the currently
 * loaded set if one exists.
 */
ipcMain.on('previous-tile', (event, idx) => {
  idx = parseInt(idx)
  if (idx > 0) {
    showTile(idx - 1)
  }
})

/**
 * Message handler to display the next tile in the currently 
 * loaded set if one exists.
 */
ipcMain.on('next-tile', (event, idx) => {
  idx = parseInt(idx)
  if (idx < (tiles.length - 1)) {
    showTile(idx + 1)
  }
})
