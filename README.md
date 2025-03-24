npm i

npm run build

npm start //To start desktop application

electron-packager . MyApp --platform=win32 --arch=x64 --out=release --overwrite --no-package-lock //This generates a .exe inside release/MyApp/.
