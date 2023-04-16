function loadProject(project_path)
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
  const out = fs.createWriteStream(output, {autoClose: false});
  inp.pipe(unzip).pipe(out);

  if(out.errored)
  {
    console.log("Error: " + out.errored);
    out.close();
    return;
  }

  const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

  const parser = new XMLParser();
  let jObj = parser.parse(text);
  
  const builder = new XMLBuilder();
  const xmlContent = builder.build(jObj);
}



// make a function that loads all subdirectories in a directory
// make a function that loads all files in a directory
function loadProjectsInDirectory(directoryPath)
{
  // get all als files in directoryPath recursively
  const fs = require('fs');
  const path = require('path');
  const files = fs.readdirSync(directoryPath);
  console.log(files);
  const alsFiles = files.filter(file => path.extname(file) === '.als');
  console.log(alsFiles);

  if(alsFiles.length == 0)
  {
    // for each file in files
    files.forEach(file => {
      //if it is a directory, call loadProjectsInDirectory
      const filePath = path.join(directoryPath, file);
      if(fs.lstatSync(filePath).isDirectory())
      {
        loadProjectsInDirectory(filePath);
      }
    });
  }
  
  //for each als file, if parent directory is not "Backup", load the project
  alsFiles.forEach(alsFile => {
    const filePath = path.join(directoryPath, alsFile);
    loadProject(filePath);
  });
}

module.exports = {loadProjectsInDirectory};