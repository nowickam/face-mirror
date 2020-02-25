# face-mirror
The program is a personal project - a <b>web application aimed at displaying a graphical interpretation of the movement of 68 facial landmarks</b>.

- The input from the webcam is read using Image Capture API, available in Chrome 59. 
- The landmarks are detected with the usage of face-api.js by [@justadudewhohacks](https://github.com/justadudewhohacks/face-api.js). The recognition models are first loaded and the position of unshifted landmarks as well as the general shift of the head are read. 
- Then the data is manipulated using a JavaScript WebGL-based library - three.js. Initial positions of the depth of particular points is hard-coded and the movement of the points is traced. The starting and ending positions of the point shift determine the Bezier curve that is drawn. The magnitude of the shift correspond to the color of the line (blue - small change, red - big change in position).

The work is open for extensions, with a prospect of adding new ways of animating the movement of the landmarks.
