mkdir $1
cd $1
yo theia-extension $@ --skip-install true --electron false &>/dev/null 
rm -rf browser-app/ electron-app/ README.md  lerna.json package.json .gitignore .yo-repository/ .vscode/
mv ./$1/* ./
rm -rf $1

