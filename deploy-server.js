const { exec } = require("child_process")

exec("deploy.bat", (err, stdout, stderr) => {
  console.log(stdout)
})