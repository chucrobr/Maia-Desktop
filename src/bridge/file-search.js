const FILE_TYPE_EXTENSIONS = Object.freeze({
  document:[".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".rtf",".odt"],
  image:[".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg",".heic"],
  video:[".mp4",".mkv",".avi",".mov",".wmv",".webm"],
  audio:[".mp3",".wav",".flac",".m4a",".aac",".ogg",".wma"],
  archive:[".zip",".rar",".7z",".tar",".gz"]
});

function fileSearchScript(query, type){
  const safe=String(query||"").replace(/'/g,"''");
  const allowed=FILE_TYPE_EXTENSIONS[String(type||"").toLowerCase()]||[];
  const extensionList=allowed.map(value=>`'${value}'`).join(",");
  return `
$roots = @("$env:USERPROFILE\\Desktop", "$env:USERPROFILE\\Documents", "$env:USERPROFILE\\Downloads")
$extensions = @(${extensionList})
$found = @()
foreach($root in $roots){
  if(Test-Path $root){
    $found += Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "*${safe}*" -and ($extensions.Count -eq 0 -or $extensions -contains $_.Extension.ToLowerInvariant()) } |
      Select-Object -First 20 FullName,Name,Length,LastWriteTime,Extension
  }
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@($found | Sort-Object LastWriteTime -Descending | Select-Object -First 30) | ConvertTo-Json -Compress
`;
}

module.exports={FILE_TYPE_EXTENSIONS,fileSearchScript};
