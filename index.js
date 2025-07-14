require('dotenv').config()
const express = require('express');
const app = express()
const prot = process.env.prot || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//*middleware
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster3.ktrbfs3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster3`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const UsersCollection = client.db('Daily-Headline-360-DB').collection('users');



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('server is running...')
})

app.listen(prot, ()=>{
    console.log(`server is running prot${prot}`)
})