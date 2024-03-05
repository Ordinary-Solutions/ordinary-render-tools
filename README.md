### ordinary-render-tools
#### Disclaimer
This project was written in 36 hours and still contains a lot of bugs. While some of these bugs may be fixed in future updates, many may remain unresolved.

# Purpose
The purpose of this project is to create tool that can render previews for lot of clothes in PNG format for further usage.

# Installation
To install this project, follow these steps:

Clone the repository using Git:
```bash
git clone https://github.com/Ordinary-Solutions/ordinary-render-tools.git
```
Navigate to the project directory and install dependencies using npm:
```bash
npm install
```
Once the dependencies are installed, run the project:
```bash
npm run dev
# then navigate to localhost:3000
```

# Usage
To use this project, follow these steps:

- Create folder and export your drawables (YDDs & YTDs) in [CodeWalker](https://github.com/dexyfex/CodeWalker) XML format.
- Drag and drop the folder onto the browser page. Folder may contain multiple (tested with 100+) XML files.

# Modded clothes
This tool supports quality models in terms of 3D (game-) design. However, note that models with excessively high polygon counts and game-specific shaders may not render correctly. They might appear weird or even throw errors during rendering. Please ensure that the models you use are within reasonable specifications to avoid rendering issues.

# Performance 
Performance depends on your hardware, including CPU, GPU and RAM. You can improve performance by adjusting the sizes of images to 512x512 or even lower. It's essential to keep sizes as small as possible. Additionally, remember that most GTA textures are 512x512, so rendering them at higher resolutions won't necessarily improve general image quality.



# Issues
As mentioned earlier, many issues may be ignored due to the nature of this project's development process. If you encounter an issue with your model, please ensure it meets the required standards before opening an issue. We do not handle models with excessively high polygon counts or large texture sizes. If you believe your model is suitable, open an issue and attach your model's XML files for further investigation.

# Pull Requests
Pull requests are appreciated. If you have improvements or fixes to contribute, feel free to submit a pull request. Your contributions are valued and will be reviewed as time permits.

Thank you for your interest in this project!