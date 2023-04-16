function loadProject(project_path : string)
{
    const zlib = require('zlib');
    const unzip = zlib.createUnzip();
    const fs = require('fs');
    console.log("Loading project: " + project_path);
    //get project paths parent directory
    const path = require('path');
    const projectDirectory = path.dirname(project_path);
    //get file name
    const projectFile = path.basename(project_path);
    const output = projectDirectory + "/Ableton Project Info/" + projectFile.replace(".als", ".xml");
    
    const inp = fs.createReadStream(project_path);
    const out = fs.createWriteStream(output);
    inp.pipe(unzip).pipe(out);
    out.on('finish', () => {
        console.log("Unzipped");

        var parseString = require('xml2js').parseString;

        fs.readFile(output, function(err : Error, data : string) {
            if(err)
            {
                console.log("Error: " + err);
                return;
            }
            var json = parseString(data, function(err : Error, result : string) {
                console.dir(result);
                console.log('Done');
            });
            console.log("to json ->", json);
        });
    });
}



// make a function that loads all subdirectories in a directory
// make a function that loads all files in a directory
export function loadProjectsInDirectory(directoryPath : string)
{
  // get all als files in directoryPath recursively
  const fs = require('fs');
  const path = require('path');
  const files = fs.readdirSync(directoryPath);
  console.log(files);
  const alsFiles = files.filter((file: string) => path.extname(file) === '.als');
  console.log(alsFiles);

  if(alsFiles.length == 0)
  {
    // for each file in files
    files.forEach((file: string) => {
      //if it is a directory, call loadProjectsInDirectory
      const filePath = path.join(directoryPath, file);
      if(fs.lstatSync(filePath).isDirectory())
      {
        loadProjectsInDirectory(filePath);
      }
    });
  }
  
  //for each als file, if parent directory is not "Backup", load the project
  alsFiles.forEach((alsFile: string) => {
    const filePath = path.join(directoryPath, alsFile);
    loadProject(filePath);
  });
}