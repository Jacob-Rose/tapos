// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron')
const path = require('path')

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInWorker: true
    }
  })

  // load the index.html of the app.
  mainWindow.loadFile('index.html')

  // add a new option to the main windows menu bar to select a directory
  const { Menu } = require('electron')
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project',
          click() { saveDirectory() }
        },
        {

          label: 'Exit',
          click() { app.quit() }
        }
      ]
    }
  ])
  mainWindow.setMenu(menu)

  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

const { loadProjectsInDirectory } = require('./project-loading.js');

function saveDirectory()
{
   // get a directory from the user using file selector
  const { dialog } = require('electron')
  const result = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  })

  if(result.length == 0)
  {
    return
  }

  // save the directory to a file
  const Store = require('electron-store');
  let store = new Store();

  store.set('directory', result[0]);
  
  //store.set('directory', );
  console.log(store.get('directory'));

  loadProjectsInDirectory(store.get('directory'));
}