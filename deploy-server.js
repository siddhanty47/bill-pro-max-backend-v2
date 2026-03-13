const express = require("express")
const { exec } = require("child_process")

const app = express()

app.use(express.json())

app.post("/deploy", (req, res) => {

  console.log("Webhook received")

  exec("./deploy.sh", (err, stdout, stderr) => {

    if (err) {
      console.error(err)
      return
    }

    console.log(stdout)
  })

  res.send("Deployment started")
})

app.listen(9000, () => {
  console.log("Webhook server running on port 9000")
})