// Methods that must be implemented by a FileSystemImpl
//
// TODO: ERROR CODES!!!!!!!
//
// stat {
//   isFile(): boolean,
//   isDirectory(): boolean,
//   mtime: Date, 
// }
//
//
// init()
// showOpenDialog(allowMultipleSelection, chooseDirectories, title, initialPath, fileTypes, function (err, data))
// showSaveDialog((title, initialPath, proposedNewFilename, callback))
// [isNetworkDrive(path, callback)]
// exists(path, callback)
// readdir(path, callback)
// mkdir(path, [mode], callback)
// rename(oldPath, newPath, callback)
// stat(path, callback)
// readFile(path, [options], callback)
// writeFile(path, data, [options], callback)
// chmod(path, mode, callback)
// unlink(path, callback)
// [moveToTrash(path, callback)]
// initWatchers(callback)
// watchPath(path)
// unwatchPath(path)
// unwatchAll()


// IAN-FS: should we augment the interface with methods to, e.g., read a number of files at once? Could be important for high-latency implementations. 
