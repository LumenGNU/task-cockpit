awk -F'"' 'BEGIN{m=0} {if(NF>=3){l=length($2); if(l>m)m=l}} END{print m}' strings.txt

//70

awk -F'"' 'NR>1{print prev} {prev=sprintf("\"%s\",", sprintf("%-70s", $2))} END{printf "\"%s\"\n", sprintf("%-70s", $2)}' strings.txt > tmp && mv tmp strings.txt
