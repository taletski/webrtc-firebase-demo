# Banuba JS SDK Demo

This project demonstrates usage of background blur filter in live video communications via WebRTC.
<!-- Check how the code works in the [Live Demo Page]() -->

## Usage
1. Clone this repo and istall dependencies
  ```
  git clone <this-repo>
  npm install
  ```
2. Create a `.env.local` file, fill it wiht your Firebase and BanubaSDK credetials as follows:
  ```
  VITE_FIREBASE_CONFIG={"app_name": "your_firebase_app_name", ...}
  VITE_BANUBA_TOKEN=your_banuba_sdk_token
  ```
3. Extract `Banuba JS SDK` source files to the `./BanubaSDK` folder
4. Run the dev server: `npm run dev`
## Credits

The core code is taken from the Fireship's [WebRTC Explanation on YouTube](https://youtu.be/WmR9IMUD_CY):
Follow the full [WebRTC Firebase Tutorial](https://fireship.io/lessons/webrtc-firebase-video-chat) on Fireship.io. 



