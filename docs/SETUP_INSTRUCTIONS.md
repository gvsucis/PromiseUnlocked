# Quick Setup Instructions

## Get Started in 5 Minutes

### Step 1: Prerequisites Check

Make sure you have:

- Node.js (v16 or higher)
- npm or yarn
- A Google account (for Gemini API)

### Step 2: Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key (it looks like: `AIzaSyC...`)

### Step 3: Configure the App

1. Open `src/config/env.ts`
2. Replace `YOUR_GEMINI_API_KEY` with your actual API key
3. Save the file

### Step 4: Install and Run

```bash
# Install dependencies
npm install

# Start the development server
npx expo start
```

### Step 5: Test the App

- **iOS**: Press `i` in the terminal or run `npm run ios`
- **Android**: Press `a` in the terminal or run `npm run android`
- **Web**: Press `w` in the terminal or run `npm run web`
- **Physical Device**: Install Expo Go app and scan the QR code

## Alternative Setup Methods

### Method 1: Automated Setup Script

```bash
./setup.sh
```

### Method 2: Manual Setup

```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Install project dependencies
npm install

# Configure API key (see Step 3 above)

# Start development server
npx expo start
```

## Running on Physical Devices

### iOS Device

1. Install "Expo Go" from App Store
2. Open Expo Go
3. Scan the QR code from terminal
4. Grant camera and photo permissions when prompted

### Android Device

1. Install "Expo Go" from Google Play Store
2. Open Expo Go
3. Scan the QR code from terminal
4. Grant camera and photo permissions when prompted

## Troubleshooting

### "Analysis Failed" Error

- Check your internet connection
- Verify API key is correctly set
- Try with a clearer, better-lit image
- Ensure transcript text is readable

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

### Permission Issues

- iOS: Go to Settings > Privacy & Security > Camera/Photos
- Android: Go to Settings > Apps > Expo Go > Permissions

## Testing the App

1. **Take a Test Photo:**

   - Use a clear, well-lit academic transcript
   - Ensure all text is readable
   - Avoid shadows and glare

2. **Expected Results:**
   - Course codes and names
   - Grades for each course
   - Credit hours
   - Overall GPA (if visible)
   - Institution details (if visible)

## Security Notes

- Your API key is stored locally in the app
- Images are processed by Google's servers
- No data is stored permanently
- Consider using environment variables for production

## Need Help?

- See [App Overview](APP_OVERVIEW.md) for detailed documentation
- Review Expo documentation: https://docs.expo.dev/
- Check Gemini API documentation: https://ai.google.dev/docs

## Next Steps

After successful setup:

1. Test with different transcript formats
2. Customize the UI if needed
3. Add additional features
4. Deploy to app stores (requires Expo EAS Build)

---

**Happy coding!**
