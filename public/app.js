
const $ = s => document.querySelector(s);
const api = '/api';

let albums = [];
let photos = [];
let active = null;
let admin = false;
let viewerIndex = 0;

const translations = {
  vi: [
    'Thư viện hình ảnh',
    'Khám phá không gian nghỉ dưỡng, hội nghị và thể thao',
    'Không gian & dịch vụ',
    'Album sự kiện',
    'Quản trị',
    'Trở về',
    'Chọn tất cả',
    'Tải ảnh đã chọn (ZIP)'
  ],
  en: [
    'Photo Gallery',
    'Discover our resort, event venues and sports facilities',
    'Spaces & Services',
    'Event Albums',
    'Admin',
    'Back',
    'Select all',
    'Download selected (ZIP)'
  ],
  zh: [
    '图片画廊',
    '探索度假村、会议场地与运动设施',
    '场地与服务',
    '活动相册',
    '管理',
    '返回',
    '全选',
    '下载所选照片 (ZIP)'
  ],
  ko: [
    '사진 갤러리',
    '리조트, 행사장 및 스포츠 시설을 만나보세요',
    '공간 및 서비스',
    '이벤트 앨범',
    '관리자',
    '뒤로',
    '모두 선택',
    '선택한 사진 ZIP 다운로드'
  ]
};

function t() {
  const v = translations[$('#lang').value] || translations.vi;
  [
    '#heroTitle',
    '#heroDesc',
    '#serviceTitle',
    '#eventTitle',
    '#adminBtn',
    '#back',
    '#selectAll',
    '#downloadZip'
  ].forEach((id, i) => {
    const node = $(id);
    if (node) node.textContent = v[i];
  });
}

$('#lang').onchange = t;

function notice(s) {
  $('#notice').textContent = s;
  setTimeout(() => {
    if ($('#notice').textContent === s) {
      $('#notice').textContent = '';
    }
  }, 7000);
}

async function req(path, opt) {
  const r = await fetch(api + path, opt);
  const j = await r.json();
  if (!r.ok) throw Error(j.error || 'Lỗi kết nối');
  return j;
}

function el(tag, cls, text) {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text !== undefined) x.textContent = text;
  return x;
}

function photoURL(p, original = false, download = false) {
  let s = `${api}/photo?id=${encodeURIComponent(p.id)}`;
  if (original) s += '&original=1';
  if (download) s += '&download=1';
  return s;
}



async function refresh() {
  try {
    const icons = {
      center1: '01',
      center2: '02',
      rooms: '⌂',
      pickleball: '◉',
      tennis: '◉',
      'vip-dining': '✧',
      gym: '◆',
      pool: '≈',
      poolside: '♨'
    };

    const data = await req('/albums');
    albums = data.albums || [];

    const serviceGrid = $('#serviceGrid');
    const eventGrid = $('#eventGrid');
    const roomGrid = $('#roomTypesGrid');
    const uploadSelect = $('#uploadAlbum');

    serviceGrid.replaceChildren();
    eventGrid.replaceChildren();
    roomGrid.replaceChildren();
    uploadSelect.replaceChildren();

    const coverMap = new Map();

    for (const album of albums) {
      const card = el('div', 'tile');
      const cover = el('div', 'cover');

      cover.textContent = album.category === 'events'
        ? '✦'
        : (icons[album.id] || '✦');

      const body = el('div', 'body');
      const title = el('h3', '', album.title);
      const count = el(
        'div',
        'muted',
        `${album.count} ảnh`
      );

      body.append(title, count);
      card.append(cover, body);

      card.onclick = () => {
        if (album.id === 'rooms') {
          openRoomTypes();
        } else {
          openAlbum(album);
        }
      };

      const target = album.category === 'events'
        ? eventGrid
        : album.category === 'room-types'
          ? roomGrid
          : serviceGrid;

      target.append(card);
      coverMap.set(album.id, cover);

      const option = document.createElement('option');
      option.value = album.id;
      option.textContent = album.title;
      uploadSelect.append(option);
    }

    async function loadCover(album, cover) {
      try {
        const result = await req(
          '/album?id=' + encodeURIComponent(album.id)
        );

        const photo = result.photos?.[0];
        if (!photo) return false;

        const image = new Image();
        image.alt = 'Ảnh đại diện ' + album.title;
        image.decoding = 'async';
        image.style.cssText =
          'width:100%;height:100%;object-fit:cover;display:block';

        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(
            new Error('Không tải được ảnh từ R2')
          );
          image.src = photoURL(photo);
        });

        cover.replaceChildren(image);
        return true;
      } catch (error) {
        console.warn(
          'Lỗi ảnh đại diện:',
          album.title,
          error.message
        );
        return false;
      }
    }

    // Ảnh đại diện cho các danh mục và album sự kiện
    await Promise.all(
      albums
        .filter(a => a.id !== 'rooms' && Number(a.count) > 0)
        .map(a => loadCover(a, coverMap.get(a.id)))
    );

    // Hệ thống phòng nghỉ lấy ảnh từ hạng phòng
    const roomsCover = coverMap.get('rooms');

    if (roomsCover) {
      const roomAlbums = albums.filter(
        a => a.category === 'room-types' && Number(a.count) > 0
      );

      for (const roomAlbum of roomAlbums) {
        if (await loadCover(roomAlbum, roomsCover)) break;
      }
    }

  } catch (error) {
    console.error('Lỗi tải danh mục:', error);
    notice(error.message);
  }
}

async function openAlbum(a, pw = '') {
  active = a;

  try {
    if (pw) {
      await req('/album-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: a.id,
          password: pw
        })
      });
    }

    const d = await req(
      '/album?id=' + encodeURIComponent(a.id)
    );

    photos = d.photos;

    $('#home').classList.add('hidden');
    $('#roomTypesView').classList.add('hidden');
    $('#albumView').classList.remove('hidden');

    $('#albumTitle').textContent = a.title;
    $('#albumDesc').textContent =
      d.album.description || '';

    const grid = $('#photoGrid');
    grid.replaceChildren();

    for (const [i, p] of photos.entries()) {
      const tile = el('div', 'tile');
      const img = document.createElement('img');

      img.loading = 'lazy';
      img.src = photoURL(p);
      img.alt = p.filename;
      img.onclick = () => view(i);

      const body = el('div', 'body');
      const name = el('div', 'muted', p.filename);
      const actions = el('div', 'photo-actions');

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'pick';
      check.dataset.id = p.id;
      check.onchange = updateCount;

      const btn = el('button', 'secondary', '↓');
      btn.onclick = () =>
        window.open(photoURL(p, true, true), '_blank');

      actions.append(check, btn);

      if (admin) {
        const del = el('button', 'secondary', 'X');

        del.onclick = async () => {
          if (!confirm('Xóa ảnh này?')) return;

          try {
            await req(
              '/photo?id=' + encodeURIComponent(p.id),
              { method: 'DELETE' }
            );
            await openAlbum(a);
          } catch (e) {
            notice(e.message);
          }
        };

        actions.append(del);
      }

      body.append(name, actions);
      tile.append(img, body);
      grid.append(tile);
    }

    updateCount();
  } catch (e) {
    if (String(e.message).includes('mật khẩu')) {
      const input = prompt('Nhập mật khẩu album');
      if (input !== null) return openAlbum(a, input);
    }
    notice(e.message);
  }
}

function openRoomTypes() {
  $('#home').classList.add('hidden');
  $('#albumView').classList.add('hidden');
  $('#roomTypesView').classList.remove('hidden');

  if (!albums.some(a => a.category === 'room-types')) {
    $('#roomTypesGrid').textContent =
      'Chưa có hạng phòng. Quản trị viên có thể tạo từng hạng phòng trong mục Quản trị.';
  }
}

$('#roomBack').onclick = () => {
  $('#roomTypesView').classList.add('hidden');
  $('#home').classList.remove('hidden');
};

function updateCount() {
  $('#selectedCount').textContent =
    document.querySelectorAll('.pick:checked').length +
    ' / ' + photos.length;
}

$('#back').onclick = () => {
  $('#albumView').classList.add('hidden');
  $('#home').classList.remove('hidden');
  active = null;
  refresh();
};

$('#selectAll').onclick = () => {
  const cs = [...document.querySelectorAll('.pick')];
  const all = cs.every(x => x.checked);
  cs.forEach(x => x.checked = !all);
  updateCount();
};

function view(i) {
  viewerIndex = i;
  $('#bigImage').src = photoURL(photos[i], true);
  $('#viewer').classList.remove('hidden');
}

function move(n) {
  if (!photos.length) return;
  viewerIndex =
    (viewerIndex + n + photos.length) % photos.length;
  view(viewerIndex);
}

$('.close').onclick = () =>
  $('#viewer').classList.add('hidden');

$('.prev').onclick = () => move(-1);
$('.next').onclick = () => move(1);

$('#viewer').onclick = e => {
  if (e.target.id === 'viewer') {
    $('#viewer').classList.add('hidden');
  }
};

$('#downloadOriginal').onclick = () => {
  if (!photos.length) return;
  window.open(
    photoURL(photos[viewerIndex], true, true),
    '_blank'
  );
};

$('#downloadZip').onclick = async () => {
  const ids = new Set(
    [...document.querySelectorAll('.pick:checked')]
      .map(x => x.dataset.id)
  );

  const selected = photos.filter(x => ids.has(x.id));

  if (!selected.length)
    return notice('Chọn ít nhất một ảnh');

  if (!window.JSZip)
    return notice('Không tải được thư viện ZIP.');

  if (selected.length > 25)
    return notice('Hãy tải tối đa 25 ảnh mỗi lần');

  const btn = $('#downloadZip');
  btn.disabled = true;

  try {
    const zip = new JSZip();
    let i = 0;

    for (const p of selected) {
      const r = await fetch(photoURL(p, true));

      if (!r.ok)
        throw Error('Không tải được ' + p.filename);

      const b = await r.blob();

      zip.file(
        `${String(++i).padStart(3, '0')}-${p.filename}`,
        b
      );

      btn.textContent =
        `Đang chuẩn bị ${i}/${selected.length}`;
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'STORE'
    });

    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = u;
    a.download =
      (active?.title || 'album')
        .replace(/[^\p{L}\p{N}_-]+/gu, '_') +
      '.zip';

    a.click();

    setTimeout(() => URL.revokeObjectURL(u), 30000);
  } catch (e) {
    notice(e.message);
  } finally {
    btn.disabled = false;
    t();
  }
};

// KIỂM TRA PHIÊN QUẢN TRỊ
async function auth() {
  try {
    const data = await req('/me');
    admin = Boolean(data.admin);

    $('#loginBox').classList.toggle('hidden', admin);
    $('#adminTools').classList.toggle('hidden', !admin);
  } catch (e) {
    admin = false;
    $('#loginBox').classList.remove('hidden');
    $('#adminTools').classList.add('hidden');
    notice(e.message);
  }
}

// ĐÃ SỬA: NÚT QUẢN TRỊ
$('#adminBtn').onclick = async () => {
  const panel = $('#adminPanel');

  // Luôn mở bảng quản trị
  panel.classList.remove('hidden');

  // Tự cuộn tới khu vực quản trị
  panel.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  // Kiểm tra đăng nhập
  await auth();

  // Tự động chọn ô mật khẩu
  if (!admin) {
    setTimeout(() => {
      $('#password').focus({
        preventScroll: true
      });
    }, 400);
  }
};

// ĐĂNG NHẬP
$('#login').onclick = async () => {
  try {
    await req('/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        password: $('#password').value
      })
    });

    $('#password').value = '';

    await auth();

    if (admin) {
      notice('Đăng nhập thành công');
      $('#adminTools').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      notice('Chưa xác nhận được phiên quản trị');
    }
  } catch (e) {
    notice(e.message);
  }
};

// ĐĂNG XUẤT
$('#logout').onclick = async () => {
  try {
    await req('/logout', {
      method: 'POST'
    });

    admin = false;
    await auth();
    notice('Đã đăng xuất');
  } catch (e) {
    notice(e.message);
  }
};

// TẠO ALBUM
$('#createAlbum').onclick = async () => {
  const title = $('#newTitle').value.trim();
  const priv = $('#privateAlbum').checked;
  const password = $('#albumPassword').value;

  if (!title)
    return notice('Nhập tên album');

  if (priv && !password)
    return notice('Album riêng tư cần mật khẩu');

  try {
    await req('/albums', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        title,
        category: $('#newCategory').value,
        description: $('#newDesc').value,
        private: priv,
        password
      })
    });

    $('#newTitle').value = '';
    $('#newDesc').value = '';
    $('#albumPassword').value = '';

    await refresh();
    notice('Đã tạo album');
  } catch (e) {
    notice(e.message);
  }
};

// TẠO ẢNH XEM TRƯỚC
async function makePreview(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(
        1,
        1200 / Math.max(img.width, img.height)
      );

      const canvas = document.createElement('canvas');

      canvas.width = Math.max(
        1,
        Math.round(img.width * scale)
      );

      canvas.height = Math.max(
        1,
        Math.round(img.height * scale)
      );

      canvas.getContext('2d').drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob(b => {
        URL.revokeObjectURL(url);
        resolve(b);
      }, 'image/webp', 0.78);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

// UPLOAD ẢNH - KHÔNG GIỚI HẠN SỐ ẢNH CHỌN
$('#upload').onclick = async () => {
  const files = [...$('#files').files];
  const albumId = $('#uploadAlbum').value;

  if (!files.length)
    return notice('Chọn ảnh trước');

  if (!albumId)
    return notice('Chọn album trước');

  const btn = $('#upload');
  btn.disabled = true;

  let ok = 0;
  let failed = 0;

  try {
    for (const [i, f] of files.entries()) {
      try {
        if (f.size > 15 * 1024 * 1024) {
          throw Error('Ảnh vượt 15 MB');
        }

        const fd = new FormData();

        fd.append('albumId', albumId);
        fd.append('file', f);

        const preview = await makePreview(f);

        if (preview) {
          fd.append(
            'preview',
            preview,
            'preview.webp'
          );
        }

        await req('/upload', {
          method: 'POST',
          body: fd
        });

        ok++;
      } catch (e) {
        failed++;
        notice(f.name + ': ' + e.message);
      }

      $('#uploadStatus').textContent =
        `Thành công ${ok}, lỗi ${failed} ` +
        `- đã xử lý ${i + 1}/${files.length} ảnh`;
    }
  } finally {
    btn.disabled = false;
    $('#files').value = '';
    await refresh();
  }
};

// KHỞI TẠO
t();
refresh();
auth();

/* SAO MAI - XOA NHIEU ANH DA CHON */

const deleteSelectedBtn = document.querySelector('#deleteSelected');

if (deleteSelectedBtn) {
  const updateDeleteButton = () => {
    deleteSelectedBtn.classList.toggle('hidden', !admin);
    const count = document.querySelectorAll('.pick:checked').length;
    deleteSelectedBtn.textContent = `Xóa ${count} ảnh đã chọn`;
    deleteSelectedBtn.disabled = !admin || count === 0;
  };

  // Cập nhật nút khi chọn hoặc bỏ chọn ảnh.
  document.addEventListener('change', event => {
    if (event.target.matches('.pick')) {
      updateDeleteButton();
    }
  });

  // Theo dõi thay đổi trạng thái đăng nhập và danh sách ảnh.
  const observer = new MutationObserver(updateDeleteButton);
  observer.observe(document.querySelector('#adminTools'), {
    attributes: true,
    attributeFilter: ['class']
  });
  observer.observe(document.querySelector('#photoGrid'), {
    childList: true
  });

  document.querySelector('#selectAll')
    .addEventListener('click', () => {
      queueMicrotask(updateDeleteButton);
    });

  deleteSelectedBtn.addEventListener('click', async () => {
    if (!admin) return notice('Cần đăng nhập quản trị');

    const ids = [
      ...document.querySelectorAll('.pick:checked')
    ].map(input => input.dataset.id);

    if (!ids.length) return notice('Chưa chọn ảnh');

    if (!confirm(
      `Bạn có chắc muốn xóa vĩnh viễn ${ids.length} ảnh đã chọn?\n\nHành động này không thể hoàn tác.`
    )) return;

    deleteSelectedBtn.disabled = true;

    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await req('/photo?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        deleted++;
      } catch (error) {
        failed++;
        console.error('Không xóa được ảnh:', id, error);
      }
    }

    notice(`Đã xóa ${deleted} ảnh. Lỗi: ${failed} ảnh.`);

    if (active) {
      await openAlbum(active);
      await refresh();
    }

    updateDeleteButton();
  });

  updateDeleteButton();
}
