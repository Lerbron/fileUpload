let baseUrl = 'http://localhost:3000'
let chunkSize = 5 * 1024 * 1024
let fileSize = 0
let file = null
let hasUploaded = 0
let chunks = 0


$("#file").on('change', function () {
  file = this.files[0]
  if (!file) return null
  fileSize = file.size;
  responseChange(file)
})

// 0.响应点击
async function responseChange(file) {
  // 第一步：按照 修改时间+文件名称+最后修改时间-->MD5
  // 显示文件校验进度
  $("#process1").slideDown(200)
  // 开始校验
  let fileMd5Value = await md5File(file)
  console.log('fileMdr--->', fileMd5Value)
  // 第二步：校验文件的MD5
  let result = await checkFileMD5(file.name, fileMd5Value)
  // 如果文件已存在, 就秒传
  if (result.file) {
    alert('文件已秒传')
    return
  }
  // let exit = false
  // 显示文件上传进度
  $("#process2").slideDown(200)
  // 第三步：检查并上传MD5
  await checkAndUploadChunk(fileMd5Value, result.chunkList)
  // 第四步: 通知服务器所有分片已上传完成
  notifyServer(fileMd5Value)
}

// 1.修改时间+文件名称+最后修改时间-->MD5
function md5File(file) {
  return new Promise((resolve, reject) => {
    var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
      //chunkSize = 2097152, // Read in chunks of 2MB
      chunkSize = file.size / 100,
      //chunks = Math.ceil(file.size / chunkSize),
      chunks = 100,
      currentChunk = 0,
      spark = new SparkMD5.ArrayBuffer(),
      fileReader = new FileReader();

    fileReader.onload = function (e) {
      // console.log('read chunk nr', currentChunk + 1, 'of', chunks);
      spark.append(e.target.result); // Append array buffer
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        // alert(spark.end() + '---' + (cur - pre)); // Compute hash
        let result = spark.end()
        resolve(result)
      }
    };

    fileReader.onerror = function () {
      console.warn('oops, something went wrong.');
    };

    function loadNext() {
      var start = currentChunk * chunkSize,
        end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;

      fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
      $("#checkProcessStyle").css({
        width: (currentChunk + 1) + '%'
      })
      $("#checkProcessValue").html((currentChunk + 1) + '%')
      // $("#tip").html(currentChunk)
    }

    loadNext();
  })
}
// 2.校验文件的MD5
function checkFileMD5(fileName, fileMd5Value) {
  return new Promise((resolve, reject) => {
    let url = baseUrl + '/check/file?fileName=' + fileName + "&fileMd5Value=" + fileMd5Value
    $.getJSON(url, function (data) {
      resolve(data)
    })
  })
}
// 3.上传chunk
async function checkAndUploadChunk(fileMd5Value, chunkList) {
  chunks = Math.ceil(fileSize / chunkSize)
  hasUploaded = chunkList.length
  for (let i = 0; i < chunks; i++) {
    let exit = chunkList.indexOf(i + "") > -1
    // 如果已经存在, 则不用再上传当前块
    if (!exit) {
      let index = await upload(i, fileMd5Value, chunks)
      hasUploaded++
      let radio = Math.floor((hasUploaded / chunks) * 100)
      $("#uploadProcessStyle").css({
        width: radio + '%'
      })
      $("#uploadProcessValue").html(radio + '%')
    }
  }
}

// 3-2. 上传chunk
function upload(i, fileMd5Value, chunks) {
  return new Promise((resolve, reject) => {
    //构造一个表单，FormData是HTML5新增的
    let end = (i + 1) * chunkSize >= file.size ? file.size : (i + 1) * chunkSize
    let form = new FormData()
    form.append("data", file.slice(i * chunkSize, end)) //file对象的slice方法用于切出文件的一部分
    form.append("total", chunks) //总片数
    form.append("index", i) //当前是第几片     
    form.append("fileMd5Value", fileMd5Value)
    $.ajax({
      url: baseUrl + "/upload",
      type: "POST",
      data: form, //刚刚构建的form数据对象
      async: true, //异步
      processData: false, //很重要，告诉jquery不要对form进行处理
      contentType: false, //很重要，指定为false才能形成正确的Content-Type
      success: function (data) {
        resolve(data.desc)
      }
    })
  })

}

// 第四步: 通知服务器所有分片已上传完成
function notifyServer(fileMd5Value) {
  let url = baseUrl + '/merge?md5=' + fileMd5Value + "&fileName=" + file.name + "&size=" + file.size
  $.getJSON(url, function (data) {
    alert('上传成功')
  })
}