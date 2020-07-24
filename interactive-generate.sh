printf "Extension name: "
read -r extensionName

printf "Extension type (widget | hello-world | labelprovider): "
read -r extensionType

printf "Author: "
read -r author

printf "Licence: "
read -r licence

printf "Description: "
read -r description

./generate-extension.sh $extensionName --extensionType $extensionType --author $author --licence $licence --description $description

echo "Created extension $extensionName"


