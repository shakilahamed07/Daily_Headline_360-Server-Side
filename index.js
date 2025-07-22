require("dotenv").config();
const express = require("express");
const app = express();
const prot = process.env.prot || 5000;
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//*middleware
app.use(cors());
app.use(express.json());

//& JWT token Verify
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorize access" });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.decoded = decoded;
    next();
  });
}


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
    const UsersCollection = client
      .db("Daily-Headline-360-DB")
      .collection("users");
    const publishersCollection = client
      .db("Daily-Headline-360-DB")
      .collection("publishers");
    const articlesCollection = client
      .db("Daily-Headline-360-DB")
      .collection("articles");
    const paymentsCollection = client
      .db("Daily-Headline-360-DB")
      .collection("payments");

    //& Create jwt token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, secretKey, { expiresIn: '30d' });
      res.send({ token });
    });

    //& Admin verify
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await UsersCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    //* read
    app.get("/users", async (req, res) => {
      const result = await UsersCollection.find().toArray();
      res.send(result);
    });

    // //* users statistics
    // app.get('/users/statistics', async (req, res) => {
    //   try {
    //     const result = await UsersCollection.aggregate([
    //       {
    //         $facet: {
    //           total: [{ $count: "count" }],
    //           normalUsers: [
    //             { $match: { role: "user", premiumToken: null } },
    //             { $count: "count" }
    //           ],
    //           premiumUsers: [
    //             { $match: { role: "user", premiumToken: { $ne: null } } },
    //             { $count: "count" }
    //           ]
    //         }
    //       },
    //       {
    //         $project: {
    //           total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
    //           normalUsers: { $ifNull: [{ $arrayElemAt: ["$normalUsers.count", 0] }, 0] },
    //           premiumUsers: { $ifNull: [{ $arrayElemAt: ["$premiumUsers.count", 0] }, 0] }
    //         }
    //       }
    //     ]).toArray();

    //     res.send(result[0]);
    //   } catch (err) {
    //     res.status(500).send({ error: "Failed to fetch statistics" });
    //   }
    // });

    //& user role
    app.get("/users/role/:email", verifyJWT, async (req, res) => {
      const query = { email: req.params.email };
      const result = await UsersCollection.findOne(query);
      res.send(result);
    });

    //! make admin
    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const result = await UsersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } }
      );
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

    //! add publisher DB
    app.post("/publishers", verifyJWT, verifyAdmin, async (req, res) => {
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

    //& add articles DB
    app.post("/articles", verifyJWT, async (req, res) => {
      const articleData = req.body;
      const result = await articlesCollection.insertOne(articleData);

      res.send(result);
    });

    //& get all articles
    app.get("/articles", verifyJWT, async (req, res) => {
      const result = await articlesCollection
        .find()
        .sort({ posted_date: -1 })
        .toArray();
      res.send(result);
    });

    //* top 6 views article
    app.get("/articles/trending", async (req, res) => {
      const trending = await articlesCollection
        .find({ status: "approved" })
        .sort({ views: -1 })
        .limit(6)
        .toArray();

      res.send(trending);
    });

    //& get all premium articles
    app.get("/premium-articles", verifyJWT, async (req, res) => {
      const result = await articlesCollection
        .find({ isPremium: true })
        .sort({ posted_date: -1 })
        .toArray();
      res.send(result);
    });

    //& get my articles
    app.get("/my-articles/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { creator_email: email };
      const result = await articlesCollection
        .find(filter)
        .sort({ posted_date: -1 })
        .toArray();
      res.send(result);
    });

    //& approve article update
    app.patch("/articles/update/:id",  verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateData = req.body;
      console.log(updateData);
      const updateDoc = {
        $set: updateData,
      };

      const result = await articlesCollection.updateOne(query, updateDoc, {
        upsert: true,
      });
      res.send(result);
    });

    //& get single article
    app.get("/article-details/:id",  verifyJWT, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await articlesCollection.findOne(query);
      res.send(result);
    });

    //* get approved articles
    app.get("/approved/articles", async (req, res) => {
      const { publisher, tags, search } = req.query;

      const filter = { status: "approved" };

      // Filter by publisher
      if (publisher) {
        filter["publisher"] = publisher;
      }

      // Filter by tags (can be comma-separated)
      if (tags) {
        const tagArray = tags.split(",");
        filter.tags = { $in: tagArray };
      }

      // Search by title (case-insensitive)
      if (search) {
        filter.title = { $regex: search, $options: "i" };
      }

      const result = await articlesCollection
        .find(filter)
        .sort({ posted_date: -1 })
        .toArray();

      res.send(result);
    });

    //! approve article update
    app.patch("/approve/article/:id",  verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: "approved" },
      };

      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //! premium or free article
    app.patch("/premium/article/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const value = req.body.value;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { isPremium: value },
      };

      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //! article decline
    app.patch("/articles/decline/:declineId", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.declineId;
      const reason = req.body.reason;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { decline_reason: reason, status: "decline" },
      };

      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //& Delate article
    app.delete("/delete/article/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.deleteOne(query);
      res.send(result);
    });

    //& article view Increase
    app.patch("/articles/view-Increase/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await articlesCollection.updateOne(query, {
        $inc: { views: 1 },
      });
      res.send(result);
    });

    //& Stripe payment
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const { amount, currency } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    //& save payment history
    app.post("/payments", verifyJWT, async (req, res) => {
      const data = req.body;
      const result = await paymentsCollection.insertOne(data);
      res.send(result);
    });

    //& subscription
    app.patch("/users/subscription/:email", verifyJWT, async (req, res) => {
      const query = { email: req.params.email };
      const { expireTime } = req.body;
      const result = await UsersCollection.updateOne(query, {
        $set: { premiumToken: expireTime },
      });
      res.send(result);
    });

    //& PATCH premium-null
    app.patch("/users/premium-null/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await UsersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { premiumToken: null } }
      );
      res.send(result);
    });

    //! Admin statistics
    app.get("/dashboard/article-stats",verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const result = await articlesCollection
          .aggregate([
            {
              $group: {
                _id: "$publisher",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                publisher: "$_id",
                count: 1,
                _id: 0,
              },
            },
          ])
          .toArray();

        const total = result.reduce((sum, pub) => sum + pub.count, 0);

        const percentageData = result.map((pub) => ({
          publisher: pub.publisher,
          percentage: ((pub.count / total) * 100).toFixed(2),
        }));

        res.send(percentageData);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    //! Admin statistics
    app.get("/income/weekly",verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const result = await paymentsCollection
          .aggregate([
            {
              $addFields: {
                payDateConverted: { $toDate: "$pay_date" },
              },
            },
            {
              $match: {
                payDateConverted: {
                  $gte: sevenDaysAgo,
                  $lte: today,
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$payDateConverted",
                  },
                },
                totalIncome: { $sum: "$amount" },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ])
          .toArray();

        res.send(result);
      } catch (err) {
        console.error("Income aggregation error:", err);
        res.status(500).send({ error: "Failed to fetch income data" });
      }
    });

    //! Admin statistics
    app.get("/articles/top-views",verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const result = await articlesCollection
          .aggregate([
            {
              $match: { status: "approved" }, 
            },
            {
              $sort: { views: -1 },
            },
            {
              $limit: 5,
            },
            {
              $project: {
                _id: 0,
                title: 1,
                publisher: 1,
                views: 1,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch top viewed articles" });
      }
    });


    //*








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
