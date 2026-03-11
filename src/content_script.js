// 严格模式避免隐式错误
'use strict';
// 唯一ID生成（兼容低版本浏览器）
var overlayId = window.crypto?.randomUUID ? crypto.randomUUID() : 'dl-loading-' + Date.now() + Math.random().toString(36).substr(2, 8);
// 下载文件名模板（可自定义）
var dlFileName = '{original}.{ext}';
// 全局加载状态锁（避免重复遮罩）
var isLoading = false;

/**
 * 显示加载框（修复this指向+状态锁）
 */
function showLoading() {
    if (isLoading) return;
    isLoading = true;
    var overlay = document.getElementById(overlayId);
    overlay && (overlay.style.display = 'flex');
}

/**
 * 隐藏加载框（强制解锁+兜底）
 */
function hideLoading() {
    isLoading = false;
    var overlay = document.getElementById(overlayId);
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * 异步GET请求（替代废弃的同步XHR，增加微博请求头伪装）
 * @param {string} url 请求地址
 * @returns {Promise<any>} 响应结果
 */
async function httpGet(url) {
    const headers = new Headers({
        'User-Agent': navigator.userAgent,
        'Referer': 'https://weibo.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
    });
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
            credentials: 'include', // 携带cookie，避免微博登录态失效
            mode: 'cors'
        });
        if (!response.ok) throw new Error(`请求失败: ${response.status}`);
        return await response.json(); // 直接返回JSON，无需手动解析
    } catch (error) {
        console.error('GET请求异常:', error);
        hideLoading();
        alert('请求微博数据失败，请检查登录态或网络');
        throw error;
    }
}

/**
 * 下载图片（异步改造+异常兜底+资源清理）
 * @param {string} imageUrl 图片地址
 * @param {string} name 保存文件名
 */
function downloadImage(imageUrl, name) {
    showLoading();
    // 替换微博图片为高清无水印版
    const realImgUrl = imageUrl.replace('/orj480/', '/large/').replace('/mw690/', '/large/');
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            try {
                if (xhr.status !== 200) throw new Error(`图片请求失败: ${xhr.status}`);
                var blob = new Blob([xhr.response], { type: 'image/jpeg' });
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                // 延迟清理（兼容部分浏览器下载逻辑）
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    hideLoading();
                }, 300);
            } catch (e) {
                console.error('图片下载失败:', e);
                hideLoading();
                alert(`图片${name}下载失败`);
            }
        }
    };
    // 所有异常分支都强制隐藏加载框
    xhr.onabort = hideLoading;
    xhr.onerror = hideLoading;
    xhr.ontimeout = hideLoading;
    xhr.open('GET', realImgUrl);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = 10000; // 10秒超时
    xhr.send();
}

/**
 * 下载包装器（区分视频/图片，修复this指向）
 * @param {string} url 资源地址
 * @param {string} name 保存文件名
 * @param {string} type 资源类型：video/pic
 */
function downloadWrapper(url, name, type) {
    if (type === 'video') {
        showLoading();
        fetch(url, {
            headers: { 'Referer': 'https://weibo.com/', 'User-Agent': navigator.userAgent },
            credentials: 'include'
        }).then(response => {
            if (response.ok) return response.blob();
            throw new Error(`视频请求失败: ${response.status}`);
        }).then(blob => {
            var downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = name;
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            // 清理资源
            URL.revokeObjectURL(downloadLink.href);
            document.body.removeChild(downloadLink);
            hideLoading();
        }).catch(error => {
            console.error('视频下载失败:', error);
            hideLoading();
            alert(`视频${name}下载失败`);
        });
    } else if (type === 'pic') {
        downloadImage(url, name);
    }
}

/**
 * 批量下载处理（增加空列表判断）
 * @param {Array} downloadList 下载列表：[{url, name, type}]
 */
function handleDownloadList(downloadList) {
    if (!Array.isArray(downloadList) || downloadList.length === 0) {
        hideLoading();
        alert('暂无可下载的媒体资源');
        return;
    }
    // 批量下载增加间隔，避免浏览器请求阻塞
    downloadList.forEach((item, index) => {
        setTimeout(() => {
            downloadWrapper(item.url, item.name, item.type);
        }, index * 500);
    });
}

/**
 * 生成自定义文件名（修复时间格式化兜底+特殊字符过滤增强）
 * @param {string} nameSetting 模板
 * @param {string} originalName 原文件名
 * @param {string} ext 后缀
 * @param {string} userName 用户名
 * @param {string} userId 用户ID
 * @param {string} postId 帖子ID
 * @param {string} postUid 帖子UID
 * @param {string} index 索引
 * @param {string} postTime 发布时间
 * @param {string} content 帖子内容
 * @returns {string} 处理后的文件名
 */
function getName(nameSetting, originalName, ext, userName, userId, postId, postUid, index, postTime, content) {
    let setName = nameSetting || '{original}.{ext}';
    // 基础变量替换
    setName = setName.replace(/{ext}/g, ext || 'jpg')
        .replace(/{original}/g, originalName || 'weibo_file')
        .replace(/{username}/g, userName || 'unknown_user')
        .replace(/{userid}/g, userId || '')
        .replace(/{mblogid}/g, postId || '')
        .replace(/{uid}/g, postUid || '')
        .replace(/{index}/g, index || '');
    // 内容截取兜底（避免content为null/undefined）
    const contentStr = content ? String(content).substring(0, 50) : '';
    setName = setName.replace(/{content}/g, contentStr);
    // 时间格式化（兜底处理无效时间）
    let YYYY = '', MM = '', DD = '', HH = '', mm = '', ss = '';
    try {
        const postAt = new Date(postTime);
        if (!isNaN(postAt.getTime())) {
            YYYY = postAt.getFullYear().toString();
            MM = (postAt.getMonth() + 1).toString().padStart(2, '0');
            DD = postAt.getDate().toString().padStart(2, '0');
            HH = postAt.getHours().toString().padStart(2, '0');
            mm = postAt.getMinutes().toString().padStart(2, '0');
            ss = postAt.getSeconds().toString().padStart(2, '0');
        }
    } catch (e) {}
    // 时间变量替换
    setName = setName.replace(/{YYYY}/g, YYYY)
        .replace(/{MM}/g, MM)
        .replace(/{DD}/g, DD)
        .replace(/{HH}/g, HH)
        .replace(/{mm}/g, mm)
        .replace(/{ss}/g, ss);
    // 增强特殊字符过滤（兼容Windows/macOS文件名规则）
    return setName.replace(/[<|>|*|"|\/|\\|:|?|\n|\r|\t|/]/g, '_').replace(/\s+/g, '');
}

/**
 * 处理视频资源（修复地址解析兜底）
 * @param {object} mediaInfo 视频信息
 * @param {number} padLength 索引补零长度
 * @param {string} userName 用户名
 * @param {string} userId 用户ID
 * @param {string} postId 帖子ID
 * @param {string} postUid 帖子UID
 * @param {number} index 索引
 * @param {string} postTime 发布时间
 * @param {string} text 帖子内容
 * @returns {Array} 下载列表
 */
function handleVideo(mediaInfo, padLength, userName, userId, postId, postUid, index, postTime, text) {
    const newList = [];
    try {
        // 视频地址解析兜底
        let largeVidUrl = mediaInfo?.playback_list?.[0]?.play_info?.url || mediaInfo?.stream_url || '';
        if (!largeVidUrl) return newList;
        // 解析文件名和后缀
        let vidName = largeVidUrl.split('?')[0].split('/').pop() || 'weibo_video';
        let [originalName, ext] = vidName.split('.').length >= 2 ? vidName.split('.') : [vidName, 'mp4'];
        // 生成文件名
        const setName = getName(dlFileName, originalName, ext, userName, userId, postId, postUid, index.toString().padStart(padLength, '0'), postTime, text);
        newList.push({ url: largeVidUrl, name: setName, type: 'video' });
        // 处理视频封面
        if (mediaInfo?.pic_info?.pic_big?.url) {
            let largePicUrl = mediaInfo.pic_info.pic_big.url.replace('/orj480/', '/large/');
            let picName = largePicUrl.split('?')[0].split('/').pop() || 'video_cover';
            let [picOriginal, picExt] = picName.split('.').length >= 2 ? picName.split('.') : [picName, 'jpg'];
            const picSetName = getName(dlFileName, picOriginal, picExt, userName, userId, postId, postUid, index.toString().padStart(padLength, '0'), postTime, text + '_封面');
            newList.push({ url: largePicUrl, name: picSetName, type: 'pic' });
        }
    } catch (e) {
        console.error('视频资源处理失败:', e);
    }
    return newList;
}

/**
 * 处理图片资源（修复视频地址解析+高清地址替换）
 * @param {object} pic 图片信息
 * @param {number} padLength 索引补零长度
 * @param {string} userName 用户名
 * @param {string} userId 用户ID
 * @param {string} postId 帖子ID
 * @param {string} postUid 帖子UID
 * @param {number} index 索引
 * @param {string} postTime 发布时间
 * @param {string} text 帖子内容
 * @returns {Array} 下载列表
 */
function handlePic(pic, padLength, userName, userId, postId, postUid, index, postTime, text) {
    const newList = [];
    try {
        // 高清图片地址（兜底处理）
        let largePicUrl = pic?.largest?.url || pic?.url || '';
        if (!largePicUrl) return newList;
        largePicUrl = largePicUrl.replace('/orj480/', '/large/').replace('/mw690/', '/large/');
        // 解析图片文件名
        let picName = largePicUrl.split('?')[0].split('/').pop() || 'weibo_pic';
        let [originalName, ext] = picName.split('.').length >= 2 ? picName.split('.') : [picName, 'jpg'];
        // 生成图片文件名
        const setName = getName(dlFileName, originalName, ext, userName, userId, postId, postUid, index.toString().padStart(padLength, '0'), postTime, text);
        newList.push({ url: largePicUrl, name: setName, type: 'pic' });
        // 处理图片附带的视频
        if (pic?.video) {
            let videoUrl = decodeURIComponent(pic.video); // 解码转义地址
            let videoName = videoUrl.split('%2F').pop() || videoUrl.split('/').pop() || 'weibo_pic_video';
            videoName = videoName.split('?')[0];
            let [vidOriginal, vidExt] = videoName.split('.').length >= 2 ? videoName.split('.') : [videoName, 'mp4'];
            const vidSetName = getName(dlFileName, vidOriginal, vidExt, userName, userId, postId, postUid, index.toString().padStart(padLength, '0'), postTime, text + '_视频');
            newList.push({ url: videoUrl, name: vidSetName, type: 'video' });
        }
    } catch (e) {
        console.error('图片资源处理失败:', e);
    }
    return newList;
}

/**
 * 为微博正文页添加下载按钮（适配最新DOM结构）
 * @param {HTMLElement} footer 底部工具栏元素
 */
function addDlBtn(footer) {
    if (footer.querySelector('.download-button')) return; // 避免重复添加
    // 适配微博最新样式类
    const dlBtnDiv = document.createElement('div');
    const divInDiv = document.createElement('div');
    if (footer.querySelector('._item_198pe_23')) {
        dlBtnDiv.className = 'woo-box-item-flex toolbar_item_1ky_D _item_198pe_23 _cursor_198pe_184';
        divInDiv.className = 'woo-box-flex woo-box-alignCenter woo-box-justifyCenter _likebox_198pe_50 _wrap_198pe_137';
    } else {
        dlBtnDiv.className = 'woo-box-item-flex toolbar_item_1ky_D toolbar_cursor_34j5V';
        divInDiv.className = 'woo-box-flex woo-box-alignCenter woo-box-justifyCenter toolbar_wrap_np6Ug';
    }
    // 创建下载按钮
    const dlBtn = document.createElement('button');
    dlBtn.className = 'woo-like-main toolbar_btn_Cg9tz download-button';
    dlBtn.tabIndex = 0;
    dlBtn.title = '下载媒体';
    dlBtn.innerHTML = '<span class="woo-like-count">下载</span>';
    // 按钮点击事件（异步改造+获取帖子ID兜底）
    dlBtn.addEventListener('click', async function (event) {
        event.preventDefault();
        showLoading();
        // 向上查找帖子根节点（兜底处理DOM层级变化）
        let article = this.closest('article');
        if (!article) {
            hideLoading();
            alert('未找到帖子信息');
            return;
        }
        // 获取帖子ID（适配微博最新时间戳链接）
        let postLink = article.querySelector('._time_1tpft_33, .head-info_time_6sFQg, a[href*="/status/"]');
        if (!postLink) {
            hideLoading();
            alert('未找到帖子ID');
            return;
        }
        let postId = postLink.href.split('/').pop() || postLink.href.match(/\d+/g)?.pop();
        if (!postId) {
            hideLoading();
            alert('解析帖子ID失败');
            return;
        }
        // 异步请求帖子数据（替代同步XHR）
        try {
            const resJson = await httpGet(`https://weibo.com/ajax/statuses/show?id=${postId}`);
            const status = resJson.retweeted_status || resJson; // 处理转发帖
            // 提取帖子核心信息
            const { mblogid, pic_infos, mix_media_info, page_info, user, idstr, created_at, text_raw } = status;
            const userName = user?.screen_name || '';
            const userId = user?.idstr || '';
            const postUid = idstr || '';
            const postTime = created_at || '';
            const text = text_raw || '';
            let downloadList = [];
            // 处理单独视频
            if (article.querySelector('video') && page_info?.media_info) {
                downloadList = downloadList.concat(handleVideo(page_info.media_info, 1, userName, userId, mblogid, postUid, 1, postTime, text));
            }
            // 处理多图片
            if (pic_infos && Object.keys(pic_infos).length > 0) {
                const picKeys = Object.keys(pic_infos);
                const padLength = picKeys.length.toString().length;
                picKeys.forEach((key, idx) => {
                    downloadList = downloadList.concat(handlePic(pic_infos[key], padLength, userName, userId, mblogid, postUid, idx + 1, postTime, text));
                });
            }
            // 处理混合媒体（图+视频）
            if (mix_media_info?.items && mix_media_info.items.length > 0) {
                const padLength = mix_media_info.items.length.toString().length;
                mix_media_info.items.forEach((item, idx) => {
                    if (item.type === 'video') {
                        downloadList = downloadList.concat(handleVideo(item.data.media_info, padLength, userName, userId, mblogid, postUid, idx + 1, postTime, text));
                    } else if (item.type === 'pic') {
                        downloadList = downloadList.concat(handlePic(item.data, padLength, userName, userId, mblogid, postUid, idx + 1, postTime, text));
                    }
                });
            }
            // 执行批量下载
            handleDownloadList(downloadList);
        } catch (e) {
            console.error('正文页下载失败:', e);
            hideLoading();
        }
    });
    // 挂载按钮
    divInDiv.appendChild(dlBtn);
    dlBtnDiv.appendChild(divInDiv);
    const toolbarContainer = footer.firstElementChild?.firstElementChild?.firstElementChild;
    toolbarContainer && toolbarContainer.appendChild(dlBtnDiv);
}

/**
 * 为微博搜索页/列表页添加下载按钮（适配最新DOM结构）
 * @param {HTMLElement} footer 底部工具栏元素
 */
function sAddDlBtn(footer) {
    if (footer.querySelector('.download-button')) return;
    // 调整列表项宽度
    const lis = footer.querySelectorAll('li');
    lis.forEach(li => li.style.width = '25%');
    // 创建按钮元素
    const dlBtnLi = document.createElement('li');
    dlBtnLi.style.width = '25%';
    const aInLi = document.createElement('a');
    aInLi.className = 'woo-box-flex woo-box-alignCenter woo-box-justifyCenter';
    aInLi.title = '下载媒体';
    aInLi.href = 'javascript:void(0);';
    const dlBtn = document.createElement('button');
    dlBtn.className = 'woo-like-main toolbar_btn download-button';
    dlBtn.innerHTML = '<span class="woo-like-count">下载</span>';
    // 阻止a标签默认行为
    aInLi.addEventListener('click', e => e.preventDefault());
    // 按钮点击事件（异步改造）
    dlBtn.addEventListener('click', async function (event) {
        event.preventDefault();
        showLoading();
        // 查找帖子mid（列表页核心标识）
        const cardWrap = this.closest('.card-wrap');
        const mid = cardWrap?.getAttribute('mid') || cardWrap?.getAttribute('data-mid');
        if (!mid) {
            hideLoading();
            alert('未找到帖子标识');
            return;
        }
        // 异步请求帖子数据
        try {
            const resJson = await httpGet(`https://weibo.com/ajax/statuses/show?id=${mid}`);
            const status = resJson.retweeted_status || resJson;
            // 提取核心信息
            const { mblogid, pic_infos, mix_media_info, page_info, user, idstr, created_at, text_raw } = status;
            const userName = user?.screen_name || '';
            const userId = user?.idstr || '';
            const postUid = idstr || '';
            const postTime = created_at || '';
            const text = text_raw || '';
            let downloadList = [];
            // 处理单独视频
            if (footer.parentElement.querySelector('video') && page_info?.media_info) {
                downloadList = downloadList.concat(handleVideo(page_info.media_info, 1, userName, userId, mblogid, postUid, 1, postTime, text));
            }
            // 处理多图片
            if (pic_infos && Object.keys(pic_infos).length > 0) {
                const picKeys = Object.keys(pic_infos);
                const padLength = picKeys.length.toString().length;
                picKeys.forEach((key, idx) => {
                    downloadList = downloadList.concat(handlePic(pic_infos[key], padLength, userName, userId, mblogid, postUid, idx + 1, postTime, text));
                });
            }
            // 处理混合媒体
            if (mix_media_info?.items && mix_media_info.items.length > 0) {
                const padLength = mix_media_info.items.length.toString().length;
                mix_media_info.items.forEach((item, idx) => {
                    if (item.type === 'video') {
                        downloadList = downloadList.concat(handleVideo(item.data.media_info, padLength, userName, userId, mblogid, postUid, idx + 1, postTime, text));
                    } else if (item.type === 'pic') {
                        downloadList = downloadList.concat(handlePic(item.data, padLength, userName, userId, mblogid, postUid, idx + 1, postTime, text));
                    }
                });
            }
            handleDownloadList(downloadList);
        } catch (e) {
            console.error('列表页下载失败:', e);
            hideLoading();
        }
    });
    // 挂载按钮
    aInLi.appendChild(dlBtn);
    dlBtnLi.appendChild(aInLi);
    const footerUl = footer.firstElementChild;
    footerUl && footerUl.appendChild(dlBtnLi);
}

/**
 * 鼠标悬浮时动态添加下载按钮（防抖+适配多域名）
 * @param {Event} event 鼠标事件
 */
function bodyMouseOver(event) {
    // 防抖：避免频繁触发DOM查询
    if (bodyMouseOver.timer) clearTimeout(bodyMouseOver.timer);
    bodyMouseOver.timer = setTimeout(() => {
        const host = window.location.host;
        // 处理微博正文域（weibo.com/www.weibo.com）
        if (host === 'weibo.com' || host === 'www.weibo.com') {
            const footers = document.querySelectorAll('footer');
            footers.forEach(footer => {
                const article = footer.parentElement;
                if (article?.tagName.toLowerCase() === 'article') {
                    // 判断是否包含媒体资源
                    const hasMedia = article.querySelector('.woo-picture-img, .picture_focusImg_1z5In, video, ._focusImg_a2k8z_23');
                    if (hasMedia) addDlBtn(footer);
                }
            });
        }
        // 处理微博搜索/列表域（s.weibo.com）
        else if (host === 's.weibo.com') {
            const footers = document.querySelectorAll('#pl_feedlist_index .card-act');
            footers.forEach(footer => {
                const card = footer.parentElement;
                const cardWrap = card?.parentElement;
                if (card?.className.includes('card') && cardWrap?.className.includes('card-wrap')) {
                    const hasMedia = card.querySelector('div[node-type="feed_list_media_prev"], video, img[src*=".sinaimg.cn/"]');
                    if (hasMedia) sAddDlBtn(footer);
                }
            });
        }
    }, 200);
}

/**
 * 初始化加载遮罩层和样式（兼容低版本浏览器）
 */
function initLoadingOverlay() {
    // 避免重复创建
    if (document.getElementById(overlayId)) return;
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.display = 'none';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.backdropFilter = 'blur(3px)';
    // 创建加载动画
    const loadingAnimation = document.createElement('div');
    loadingAnimation.style.width = '50px';
    loadingAnimation.style.height = '50px';
    loadingAnimation.style.border = '5px solid #fff';
    loadingAnimation.style.borderRadius = '50%';
    loadingAnimation.style.borderTop = '5px solid #1687ff';
    loadingAnimation.style.animation = 'spin 1s linear infinite';
    // 挂载动画
    overlay.appendChild(loadingAnimation);
    document.body.appendChild(overlay);
    // 添加旋转动画样式（避免样式隔离问题）
    if (!document.getElementById('dl-loading-style')) {
        const style = document.createElement('style');
        style.id = 'dl-loading-style';
        style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    // 初始化加载遮罩
    initLoadingOverlay();
    // 绑定鼠标悬浮事件（委托到body，兼容动态加载的DOM）
    document.body.addEventListener('mouseover', bodyMouseOver);
    // 监听页面滚动（兼容无限加载的微博列表）
    window.addEventListener('scroll', bodyMouseOver);
    console.log('微博媒体下载工具已初始化，鼠标悬浮到帖子上会自动显示【下载】按钮');
});

// 页面卸载时清理资源
window.addEventListener('unload', function () {
    hideLoading();
    document.body.removeEventListener('mouseover', bodyMouseOver);
    window.removeEventListener('scroll', bodyMouseOver);
});
