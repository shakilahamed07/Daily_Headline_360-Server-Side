require("dotenv").config();
const express = require("express");
const app = express();
const prot = process.env.prot || 5000;
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//*middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster3.ktrbfs3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster3`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const UsersCollection = client.db("Daily-Headline-360-DB").collection("users");
    const publishersCollection = client.db("Daily-Headline-360-DB").collection("publishers");
    const articlesCollection = client.db("Daily-Headline-360-DB").collection("articles");

    //* read
    app.get("/users", async (req, res) => {
      const result = await UsersCollection.find().toArray();
      res.send(result);
    });

    //* user role
    app.get("/users/role/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await UsersCollection.findOne(query);
      res.send(result);
    });

    //* create users DB
    app.post("/users", async (req, res) => {
      const { email, name, img } = req.body;
      console.log(email);

      const user = {
        name,
        img,
        email,
        role: "user",
        premiumToken: null,
        created_at: new Date().toISOString(),
        last_log_in: new Date().toISOString(),
      };

      const userExists = await UsersCollection.findOne({ email });
      if (userExists) {
        if (email) {
          await UsersCollection.updateOne(
            { email },
            { $set: { last_log_in: new Date().toISOString() } }
          );
        }
        return res
          .status(200)
          .send({ message: "user already exists", inserted: false });
      }

      const result = await UsersCollection.insertOne(user);
      res.send(result);
    });

    //* add publisher DB
    app.post("/publishers", async (req, res) => {
      const { name, logo } = req.body;
      const result = await publishersCollection.insertOne({
        name,
        logo,
        created_at: new Date().toISOString(),
      });

      res.send(result);
    });

    //* get publishers
    app.get("/publishers", async (req, res) => {
      const result = await publishersCollection.find().toArray();
      res.send(result);
    });

    //* add articles DB
    app.post("/articles", async (req, res) => {
      const articleData = req.body;
      const result = await articlesCollection.insertOne(articleData);

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running...");
});

app.listen(prot, () => {
  console.log(`server is running prot${prot}`);
});
