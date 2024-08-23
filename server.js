const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');


require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3800;

app.use(cors());
app.use(express.json()); // middleware to parse JSON

const password = '770sGrandAve7058';
const MONGODB_URI = `mongodb+srv://ColinZWang:${password}@colinzwang-cluster.6civtdf.mongodb.net/?retryWrites=true&w=majority`;

console.log("Attempting to connect to MongoDB...");

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true
  }
});

const fetchAndLogDiscussions = async () => {
    try {
      const discussions = await Discussion.find(); // fetch all discussions
      console.log("Example Discussion in the Database:");
      console.log(discussions[0]);
    } catch (error) {
      console.log("Error fetching discussions:", error);
    }
  };
  
  mongoose.connection.once('open', function() {
    console.log("Successfully connected to MongoDB.", "\n");
    fetchAndLogDiscussions(); // fetch and log discussions once database connection is open
  }).on('error', function(error) {
    console.log("Connection error:", error);
  });
  

// define schema and model for Forum Discussions
const discussionSchema = new mongoose.Schema({
    title: String,
    content: String,
    user: String,
    avatarUrl: String,
    replyTime: String,
    views: Number,
    createdAt: { type: Date, default: Date.now }, 
    comments: [{
      user: String,
      avatarUrl: String,
      content: String,
      YTEmbedLink: String,
      YT_time: String,
      Booksrc: String,
      pageno: String,
      replyTime: String,
      views: Number
    }],
    isVerified:Boolean
  });
  
const Discussion = mongoose.model('Discussion', discussionSchema);

// User-Password Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Note: Storing plain text passwords is highly insecure.
  createdAt: { type: Date, default: Date.now },
  isTA: { type: Boolean, default: false },
  verificationCode: { type: String, default: '' }
});

const User = mongoose.model('User', userSchema);
  
  
  
// API routes
app.get('/api/discussions', async (req, res) => {
    try {
        const discussions = await Discussion.find().sort({ createdAt: -1 }); // sort by creation time
        res.json(discussions.map(discussion => ({
        id: discussion._id.toString(), // convert ObjectId to string
        ...discussion.toObject(),
        comments: discussion.comments.map(comment => ({
          ...comment,
          id: comment._id.toString() // convert ObjectId to string for each comment
        }))
      })));
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
      res.status(500).json({ message: 'Failed to fetch discussions' });
    }
  });

  app.get('/api/discussions/:id', async (req, res) => {
    try {
        const discussion = await Discussion.findById(req.params.id);
        if (!discussion) {
            return res.status(404).json({ message: 'Discussion not found' });
        }
        res.json({
            id: discussion._id.toString(),
            ...discussion.toObject()
        });
    } catch (error) {
        console.error('Failed to fetch discussion:', error);
        res.status(500).json({ message: 'Failed to fetch discussion' });
    }
});
// Function to call the AI API and get the response
async function getAIResponse(userInput) {
  try {
      const response = await axios.post('https://rag-app-001-1d4e6f4c631a.herokuapp.com/query/', {
          query: userInput
      }, {
          headers: {
              'Content-Type': 'application/json'
          }
      });
      return response.data;
  } catch (error) {
      console.error('Failed to get AI response:', error);
      throw new Error('Failed to get AI response');
  }
}

app.post('/api/discussions', async (req, res) => {
  const { title, content, user, avatarUrl } = req.body;

  try {
      const newDiscussion = new Discussion({
          title,
          content,
          user,
          avatarUrl,
          replyTime: new Date().toLocaleString(),
          comments: [{
              user: 'ETA',
              avatarUrl: 'http://localhost:3000/ETA.png',
              content: '', 
              YTEmbedLink: '',
              YT_time: '',
              Booksrc: '',
              pageno: '',
              replyTime: new Date().toLocaleString(),
          }],
          isVerified: false
      });

      const savedDiscussion = await newDiscussion.save();
      res.status(201).json(savedDiscussion);

      // Async call to get AI response from the API
      try {
          const aiResponse = await getAIResponse(content);

          // Update the discussion with AI response
          await Discussion.findByIdAndUpdate(savedDiscussion._id, {
              $set: {
                  "comments.0.content": aiResponse.answer,
                  "comments.0.YTEmbedLink": aiResponse.sources.find(source => source.document.includes('ytvid'))?.document || '',
                  "comments.0.YT_time": aiResponse.sources.find(source => source.document.includes('ytvid'))?.page || '',
                  "comments.0.Booksrc": aiResponse.sources.find(source => !source.document.includes('ytvid'))?.document || '',
                  "comments.0.pageno": aiResponse.sources.find(source => !source.document.includes('ytvid'))?.page || '',
              }
          });
      } catch (error) {
          console.error('Failed to get AI response:', error);
      }
  } catch (error) {
      console.error('Failed to save new discussion:', error);
      res.status(500).send(error.message);
  }
});


  app.post('/api/register', async (req, res) => {
      try {
          const { username, password, isTA, verificationCode } = req.body;
          if (isTA && verificationCode !== 'FightOn') {
            return res.status(400).json({ message: "Invalid verification code for TA." });
          }
          const user = new User({ username, password, isTA, verificationCode });
          await user.save();
          res.status(201).json({ message: 'User created successfully', userId: user._id });
      } catch (error) {
          res.status(400).json({ message: 'Error creating user', error: error.message });
      }
  });


  app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;
      // Find user in the database
      const user = await User.findOne({ username });
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }
      // Example password verification - replace with actual check!
      if (password !== user.password) {
          return res.status(401).json({ message: 'Incorrect password' });
      }
      // Send back user data, omitting sensitive info like password
      res.json({
          user: {
              _id: user._id,
              username: user.username,
              isTA: user.isTA
          }
      });
  });


  app.post('/api/discussions/verify/:id', async (req, res) => {
    try {
      const { isVerified } = req.body;
      const discussion = await Discussion.findByIdAndUpdate(req.params.id, { isVerified }, { new: true });
      res.json(discussion);
    } catch (error) {
      res.status(500).send("Failed to verify discussion");
    }
  });  
  

  
  // start server
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
