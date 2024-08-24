# Use an official Node.js runtime as a parent image
FROM node:22

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Bundle app source code
COPY . .

# Expose the port that the app will run on
EXPOSE 3800

# Define environment variables
ENV PORT=3800

# Command to run the app
CMD ["node", "server.js"]
