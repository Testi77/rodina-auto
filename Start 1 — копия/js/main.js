import { registerUser, loginUser, logoutUser, saveCar as saveCarToFirebase, getCars, deleteCar as deleteCarFromFirebase, updateCar, onAuthStateChanged, auth, isAdmin } from "./firebase.js";

let authMode = "login";
let favorites = [];
let userId = null;
let showFavoritesOnly = false;
let editingCarId = null;
let selectedFuel = "";
let selectedCondition = "";
let currentCarId = null;
let currentLightboxImages = [];
let currentLightboxIndex = 0;

if (window.location.pathname.includes("create.html")) {
  const title = document.getElementById("formTitle");
  const btn = document.getElementById("submitBtn");
  const editingId = localStorage.getItem("editingCarId");

  if (editingId) {
    editingCarId = editingId; // режим редактирования

    if (title) title.innerText = "Редактирование объявления";
    if (btn) btn.innerText = "Сохранить изменения";

  } else {
    editingCarId = null;      // режим создания

    if (title) title.innerText = "Новое объявление";
    if (btn) btn.innerText = "Разместить объявление";

    setTimeout(resetForm, 0); // чистим форму
  }
}

let isAdminUser = false;
let cars = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = { id: user.uid, login: user.email.replace("@rodina.auto", "") };
    userId = user.uid;
    isAdminUser = await isAdmin(user.uid);
    favorites = JSON.parse(localStorage.getItem(`favorites_${userId}`)) || [];
  } else {
    currentUser = null;
    userId = null;
    isAdminUser = false;
    favorites = [];
  }

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (currentUser) {
    if (loginBtn) loginBtn.style.display = "none";
    if (registerBtn) registerBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "block";
  } else {
    if (loginBtn) loginBtn.style.display = "block";
    if (registerBtn) registerBtn.style.display = "block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }

  loadCars();
});

let showOnlyMyCars = false;

async function loadCars() {
  const list = document.getElementById("carList");
  if (list) {
    list.innerHTML = `
      ${Array(6).fill("").map(() => `
        <div class="bg-neutral-900 rounded-xl overflow-hidden border-2 border-neutral-800 animate-pulse">
          <div class="w-full h-48 bg-neutral-800"></div>
          <div class="p-3 space-y-2">
            <div class="h-5 bg-neutral-800 rounded w-3/4"></div>
            <div class="h-5 bg-neutral-800 rounded w-1/3"></div>
            <div class="grid grid-cols-3 gap-2 mt-2">
              <div class="h-12 bg-neutral-800 rounded-lg"></div>
              <div class="h-12 bg-neutral-800 rounded-lg"></div>
              <div class="h-12 bg-neutral-800 rounded-lg"></div>
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }

  try {
    cars = await getCars();
    renderCars();
    startRealtimeListener();
  } catch (e) {
    console.error("Ошибка загрузки:", e);
    renderCars();
  }
}

let realtimeUnsubscribe = null;

function startRealtimeListener() {
  if (realtimeUnsubscribe) return; // уже запущен

  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot, collection, query, orderBy, getFirestore }) => {
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js").then(({ getApps }) => {
      const db = getFirestore(getApps()[0]);
      const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));

      realtimeUnsubscribe = onSnapshot(q, (snapshot) => {
        cars = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
        renderCars();
      });
    });
  });
}

let sortType = "new";
let selectedFiles = [];
const list = document.getElementById("carList");
const CARS_PER_PAGE = 12;
let currentPage = 1;

function renderCars() {
  if (!list) return;

  let html = "";

  const searchInput = document.getElementById("searchInput");
  const search = searchInput ? searchInput.value.toLowerCase() : "";

  const filtered = [];
    cars.forEach((car, index) => {
      if (selectedServer !== "Все серверы" && car.server !== selectedServer) return;
      if (!(car.name || "").toLowerCase().includes(search)) return;
      if (showFavoritesOnly && !favorites.includes(car.id)) return;
      if (showOnlyMyCars && car.owner !== (currentUser ? currentUser.id : userId)) return;
      filtered.push({ car, index });
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / CARS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    const paginated = filtered.slice((currentPage - 1) * CARS_PER_PAGE, currentPage * CARS_PER_PAGE);

    paginated.forEach(({ car, index }) => {
      const isFav = favorites.includes(car.id);

      html += `
              <div onclick="openModalByIndex(${index})"
                   style="display:flex; flex-direction:column;"
                   class="relative bg-neutral-900 rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl border-2 border-neutral-700 hover:border-red-600">

                   <img src="${(car.images?.[0]?.value || car.images?.[0]) || 'https://placehold.co/300x200'}"
                    class="w-full h-48 object-cover" style="border-bottom:2px solid #404040;"
                    onerror="this.src='https://placehold.co/300x200?text=Нет+фото'">

            <div class="p-3">
              <h3 class="text-lg font-semibold">${car.name}</h3>
              <p class="text-red-600 text-lg font-bold mb-2">
                ${Number(car.price).toLocaleString('ru-RU')} ₽
              </p>
              <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:6px;">
            <div style="background:#262626; padding:8px; border-radius:8px; border:2px solid #404040;">
  <p style="color:#a3a3a3; font-size:12px; margin:0 0 2px 0;">Сервер</p>
  <p style="font-size:13px; font-weight:700; margin:0; color:white;">${car.server || "—"}</p>
</div>
<div style="background:#262626; padding:8px; border-radius:8px; border:2px solid #404040;">
  <p style="color:#a3a3a3; font-size:12px; margin:0 0 2px 0;">Состояние</p>
  <p style="font-size:13px; font-weight:700; margin:0; color:white;">${car.condition || "—"}${car.rating ? ` <span style="color:#dc2626;">(${car.rating})</span>` : ""}</p>
</div>
<div style="background:#262626; padding:8px; border-radius:8px; border:2px solid #404040;">
  <p style="color:#a3a3a3; font-size:12px; margin:0 0 2px 0;">Номерной знак</p>
  <p style="font-size:13px; font-weight:700; margin:0; color:white;">${car.plate || "—"}</p>
</div>
          </div>
            </div>
          </div>
        `;
  });

  // если пусто
  if (html === "") {
    html = `
      <div class="col-span-full text-center text-gray-400 py-10">
        Нет объявлений
      </div>
    `;
  }

  list.innerHTML = html;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const old = document.getElementById("pagination");
  if (old) old.remove();
  if (totalPages <= 1) return;

  const container = document.createElement("div");
  container.id = "pagination";
  container.className = "flex justify-center items-center gap-2 py-6 flex-wrap";

  const prev = document.createElement("button");
  prev.innerText = "‹";
  prev.className = `w-10 h-10 rounded-lg text-xl font-bold transition ${currentPage === 1 ? "bg-neutral-800 text-neutral-600 cursor-not-allowed" : "bg-neutral-800 text-white hover:bg-red-600"}`;
  if (currentPage > 1) prev.onclick = () => { currentPage--; renderCars(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  container.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      const btn = document.createElement("button");
      btn.innerText = i;
      btn.className = `w-10 h-10 rounded-lg text-sm font-bold transition ${i === currentPage ? "bg-red-600 text-white" : "bg-neutral-800 text-white hover:bg-red-600"}`;
      btn.onclick = () => { currentPage = i; renderCars(); window.scrollTo({ top: 0, behavior: "smooth" }); };
      container.appendChild(btn);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      const dots = document.createElement("span");
      dots.innerText = "...";
      dots.className = "text-neutral-500 px-1";
      container.appendChild(dots);
    }
  }

  const next = document.createElement("button");
  next.innerText = "›";
  next.className = `w-10 h-10 rounded-lg text-xl font-bold transition ${currentPage === totalPages ? "bg-neutral-800 text-neutral-600 cursor-not-allowed" : "bg-neutral-800 text-white hover:bg-red-600"}`;
  if (currentPage < totalPages) next.onclick = () => { currentPage++; renderCars(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  container.appendChild(next);

  list.parentNode.insertBefore(container, list.nextSibling);
}

function openModal(car) {
  currentCarId = car.id;
  // КАРТИНКА
  const modalImg = document.getElementById("modalImg");
  let currentImageIndex = 0;
  const images = (car.images && car.images.length > 0)
      ? car.images.filter(img => img).map(img => img.value || img)
      : ["https://placehold.co/800x400?text=Нет+фото"];

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    function showImage() {
          modalImg.src = images[currentImageIndex];
          currentLightboxIndex = currentImageIndex;

          // счётчик
          const counter = document.getElementById("modalCounter");
          if (counter) {
            if (images.length > 1) {
              document.getElementById("modalCounterCurrent").textContent = currentImageIndex + 1;
              document.getElementById("modalCounterTotal").textContent = images.length;
              counter.classList.remove("hidden");
            } else {
              counter.classList.add("hidden");
            }
          }

      modalImg.onclick = (e) => {
        const rect = modalImg.getBoundingClientRect();
        const clickX = e.clientX - rect.left;

        // левая часть → назад
        if (clickX < rect.width / 2) {
          if (currentImageIndex > 0) {
            currentImageIndex--;
            showImage();
          }
        }
        // правая часть → вперед
        else {
          if (currentImageIndex < images.length - 1) {
            currentImageIndex++;
            showImage();
          }
        }
      };

      modalImg.onmousemove = (e) => {
        const rect = modalImg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isLeft = x < rect.width / 2;

        prevBtn.classList.remove("!text-red-600", "!scale-110");
        nextBtn.classList.remove("!text-red-600", "!scale-110");

        if (isLeft && currentImageIndex > 0) {
          prevBtn.classList.add("!text-red-600", "!scale-110");
        } else if (!isLeft && currentImageIndex < images.length - 1) {
          nextBtn.classList.add("!text-red-600", "!scale-110");
        }
      };

      modalImg.onmouseleave = () => {
        prevBtn.classList.remove("!text-red-600", "!scale-110");
        nextBtn.classList.remove("!text-red-600", "!scale-110");
      };

      modalImg.onmouseleave = () => {
        prevBtn.classList.remove("!text-red-600", "!scale-110");
        nextBtn.classList.remove("!text-red-600", "!scale-110");
      };

      // 👇 логика стрелок
      if (images.length <= 1) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
        return;
      }

      // первая фотка
      if (currentImageIndex === 0) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "flex";
      }
      // последняя фотка
      else if (currentImageIndex === images.length - 1) {
        prevBtn.style.display = "flex";
        nextBtn.style.display = "none";
      }
      // середина
      else {
        prevBtn.style.display = "flex";
        nextBtn.style.display = "flex";
      }
    }

    prevBtn.onclick = (e) => {
      e.stopPropagation();

      if (currentImageIndex > 0) {
        currentImageIndex--;
        showImage();
      }
    };

    nextBtn.onclick = (e) => {
      e.stopPropagation();

      if (currentImageIndex < images.length - 1) {
        currentImageIndex++;
        showImage();
      }
    };

    modalImg.onerror = () => {
      modalImg.src = "https://placehold.co/800x400?text=Нет+фото";
    };

    currentImageIndex = 0;
         showImage();

         // для lightbox
         currentLightboxImages = images;
         currentLightboxIndex = 0;

  // НАЗВАНИЕ + ЦЕНА
  const isFav = favorites.includes(car.id);

  document.getElementById("modalTitle").innerHTML = `
    <div class="flex justify-between items-center w-full">

      <span class="mr-2">${car.name}</span>

      <div class="flex items-center gap-3">

        <!-- ❤️ ИЗБРАННОЕ -->
        <span onclick="toggleFavorite(${car.id}, event)"
              class="text-2xl cursor-pointer fav-heart relative z-50 group">

          <span class="absolute -top-8 left-1/2 -translate-x-1/2
                       bg-black text-white text-xs px-2 py-1 rounded
                       opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
            ${isFav ? "Убрать из избранного" : "Добавить в избранное"}
          </span>

          ${isFav
            ? `<svg xmlns="http://www.w3.org/2000/svg"
                     viewBox="0 0 24 24"
                     class="w-7 h-7 transition text-red-600"
                     fill="currentColor">
                 <path d="M16.444 3.5C19.513 3.5 22 6.002 22 9.088a5.6 5.6 0 0 1-1.723 4.045L12 22.5l-8.276-9.365A5.6 5.6 0 0 1 2 9.088C2 6.002 4.487 3.5 7.556 3.5c1.817 0 3.43.878 4.444 2.235A5.54 5.54 0 0 1 16.444 3.5"></path>
               </svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg"
                     viewBox="0 0 24 24"
                     class="w-7 h-7 transition text-gray-400 hover:text-red-600 active:text-red-600"
                     fill="currentColor">
                 <path d="M16.444 3.5C19.513 3.5 22 6.002 22 9.088a5.6 5.6 0 0 1-1.723 4.045L12 22.5l-8.276-9.365A5.6 5.6 0 0 1 2 9.088C2 6.002 4.487 3.5 7.556 3.5c1.817 0 3.43.878 4.444 2.235A5.54 5.54 0 0 1 16.444 3.5"></path>
               </svg>`
          }
        </span>

        <!-- 🔗 ПОДЕЛИТЬСЯ -->
        <span onclick="shareCar()"
              class="cursor-pointer relative group text-gray-400 hover:text-red-600 active:text-red-600 transition">

          <span class="absolute -top-8 left-1/2 -translate-x-1/2
                       bg-black text-white text-xs px-2 py-1 rounded
                       opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
            Поделиться
          </span>

          <svg xmlns="http://www.w3.org/2000/svg"
               class="w-6 h-6"
               viewBox="0 0 24 24">
            <path fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 2v13m4-9l-4-4l-4 4m-4 6v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          </svg>

        </span>

      </div>
    </div>
  `;

  document.getElementById("modalPrice").innerText =
    Number(car.price).toLocaleString('ru-RU') + " ₽";

  // ХАРАКТЕРИСТИКИ (КРАСИВЫЕ БЛОКИ)
  let stats = `
    <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
      <p class="text-gray-500 text-xs">Состояние</p>
      <p class="font-bold">
        ${car.condition || "—"}
        ${car.rating ? `<span class="text-red-600 ml-2">(${car.rating})</span>` : ""}
      </p>
    </div>

    <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
      <p class="text-gray-500 text-xs">Пробег</p>
      <p class="font-bold">
        ${car.mileage ? Number(car.mileage).toLocaleString('ru-RU') : "—"} км
      </p>
    </div>

    <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
      <p class="text-gray-500 text-xs">Номер</p>
      <p class="font-bold">${car.plate || "—"}</p>
    </div>

    ${car.fuel ? `
      <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
        <p class="text-gray-500 text-xs">Топливо</p>
        <p class="font-bold">${car.fuel}</p>
      </div>
    ` : ""}

     <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
       <p class="text-gray-500 text-xs">Сервер</p>
       <p class="font-bold">${car.server || "—"}</p>
     </div>
  `;

  document.getElementById("modalStats").innerHTML = stats;

  // ОПИСАНИЕ
  document.getElementById("modalInfo").innerHTML =
      car.comment ? `<b>Описание:</b><br>${car.comment.replace(/\n{3,}/g, "\n\n").replace(/\n/g, "<br>")}` : "";

  // КОНТАКТЫ
  let contacts = "";

  if (car.contacts) {
    contacts = `
      <div class="grid grid-cols-2 gap-3 mt-2">

      ${car.contacts.game ? `
        <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
          <p class="text-gray-500 text-xs">Игровой ник</p>
          <p class="font-bold">${car.contacts.game}</p>
        </div>
      ` : ""}

      ${car.contacts.phone ? `
        <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
          <p class="text-gray-500 text-xs">Игровой номер телефона</p>
          <p class="font-bold">${car.contacts.phone}</p>
        </div>
      ` : ""}

      ${car.contacts.tg ? `
        <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
          <p class="text-gray-500 text-xs">Telegram</p>
          <p class="font-bold">
            ${(car.contacts.tg.startsWith("@")
              ? car.contacts.tg
              : "@" + car.contacts.tg)}
          </p>
        </div>
      ` : ""}

        ${car.contacts.discord ? `
          <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
            <p class="text-gray-500 text-xs">Discord</p>
            <p class="font-bold">${car.contacts.discord}</p>
          </div>
        ` : ""}

        ${car.contacts.vk ? `
          <div class="bg-gray-100 p-3 rounded-lg border-2 border-neutral-200">
            <p class="text-gray-500 text-xs">VK</p>
            <p class="font-bold">${car.contacts.vk}</p>
          </div>
        ` : ""}

      </div>
    `;
  }

  const contactsBlock = document.getElementById("modalContacts");
  contactsBlock.innerHTML = contacts;
  contactsBlock.classList.add("hidden");

  const deleteBlock = document.getElementById("deleteBlock");

  if (
    car.owner === userId ||
    (currentUser && car.owner === currentUser.id) ||
    isAdminUser
  ) {
    deleteBlock.innerHTML = `
      <div class="flex gap-4 items-center">

        <!-- ✏️ РЕДАКТИРОВАТЬ -->
        <div class="relative group">

          <!-- tooltip -->
          <span class="absolute -top-8 left-1/2 -translate-x-1/2
                       bg-black text-white text-xs px-2 py-1 rounded
                       opacity-0 group-hover:opacity-100 transition
                       pointer-events-none whitespace-nowrap">
            Редактировать
          </span>

          <button onclick="editCar(${car.id});"
            class="text-gray-400 group-hover:text-red-600 active:text-red-600 transition">

            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24"
                 stroke-width="1.5"
                 stroke="currentColor"
                 fill="none"
                 class="w-7 h-7">

              <path stroke-linecap="round" stroke-linejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>

          </button>
        </div>

        <!-- 🗑 УДАЛИТЬ -->
        <div class="relative group">

          <!-- tooltip -->
          <span class="absolute -top-8 left-1/2 -translate-x-1/2
                       bg-black text-white text-xs px-2 py-1 rounded
                       opacity-0 group-hover:opacity-100 transition
                       pointer-events-none whitespace-nowrap">
            Удалить
          </span>

          <button onclick="deleteCarById(${car.id})"
            class="text-gray-400 group-hover:text-red-600 active:text-red-600 transition">

            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 512 512"
                 class="w-7 h-7">

              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"
                d="m112 112l20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320"/>

              <path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"
                d="M80 112h352"/>

              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"
                d="M192 112V72a24 24 0 0 1 24-24h80a24 24 0 0 1 24 24v40m-64 64v224m-72-224l8 224m136-224l-8 224"/>
            </svg>

          </button>
        </div>

      </div>
    `;
  } else {
      deleteBlock.innerHTML = "";
    }

  // ПОКАЗАТЬ МОДАЛКУ
  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.scrollTop = 0;

    setTimeout(() => {
    modal.classList.remove("bg-black/0");
    modal.classList.add("bg-black/80");
    modal.classList.remove("opacity-0");
    modal.classList.add("opacity-100");

    content.classList.remove("scale-95", "opacity-0");
    content.classList.add("scale-100", "opacity-100");
  }, 10);

  document.body.style.overflow = "hidden";
}

function openModalByIndex(index) {
  openModal(cars[index]);
}

function closeModal() {
  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");

  modal.classList.remove("opacity-100");
  modal.classList.add("opacity-0");

  modal.classList.remove("bg-black/80");
  modal.classList.add("bg-black/0");

  content.classList.remove("scale-100", "opacity-100");
  content.classList.add("scale-95", "opacity-0");

  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }, 200);

  document.body.style.overflow = "";

  history.replaceState(null, "", window.location.pathname);

    // сброс кнопки контактов
    const contactsBlock = document.getElementById("modalContacts");
    const contactsBtn = document.getElementById("contactsBtn");
    if (contactsBlock) contactsBlock.classList.add("hidden");
    if (contactsBtn) {
      contactsBtn.innerText = " Связаться с игроком";
      contactsBtn.classList.remove("bg-neutral-800", "hover:bg-neutral-700");
      contactsBtn.classList.add("bg-red-600", "hover:bg-red-600");
    }
  }

function openForm() {
  document.getElementById("formModal").classList.remove("hidden");
  document.getElementById("formModal").classList.add("flex");
}

function closeForm() {
  document.getElementById("formModal").classList.add("hidden");
  document.getElementById("formModal").classList.remove("flex");
}

function addCar() {
  if (!currentUser) {
    alert("Сначала войди в аккаунт");
    openAuth();
    return;
  }

const rating = document.getElementById("ratingInput")?.value || "";
const name = document.getElementById("nameInput").value;
const priceRaw = document.getElementById("priceInput").value;
const price = priceRaw.replace(/\s/g, "");
const server = selectedServerForm;

const submitBtn = document.getElementById("submitBtn");
if (submitBtn.disabled) return;
submitBtn.disabled = true;
submitBtn.innerText = "Публикуем...";
submitBtn.classList.add("opacity-50", "cursor-not-allowed");

function unblockBtn() {
  submitBtn.disabled = false;
  submitBtn.innerText = editingCarId ? "Сохранить изменения" : "Разместить объявление";
  submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
}

if (!server) {
  alert("Выберите сервер");
  unblockBtn();
  return;
}

if (!price || isNaN(price)) {
  alert("Введите корректную цену");
  unblockBtn();
  return;
}

  const mileageRaw = document.getElementById("mileageInput")?.value || "";
  const mileage = mileageRaw.replace(/\s/g, "");
  const plate = document.getElementById("plateInput")?.value || "";

  const tg = document.getElementById("tgInput")?.value || "";
  const discord = document.getElementById("discordInput")?.value || "";
  const vk = document.getElementById("vkInput")?.value || "";
  const game = document.getElementById("gameInput")?.value || "";
  const phone = document.getElementById("phoneInput")?.value || "";

  const fileInput = document.getElementById("fileInput");
  const linkInputs = document.querySelectorAll(".imageLink");

  let links = [];

  linkInputs.forEach(input => {
  const val = input.value.trim();
  if (
    val.startsWith("http://") ||
    val.startsWith("https://") ||
    val.startsWith("data:image")
  ) {
    links.push(val);
  }
});

  const hasFile = selectedFiles.length > 0;
  const hasLink = links.filter(l =>
  l.startsWith("http://") ||
  l.startsWith("https://") ||
  l.startsWith("data:image")
).length > 0;

  // ❗ финальная проверка лимитов
if (selectedFiles.length > 5) {
  alert("Максимум 5 файлов");
  unblockBtn();
  return;
}

if (links.length > 5) {
  alert("Максимум 5 ссылок");
  unblockBtn();
  return;
}

if (selectedFiles.length + links.length > 10) {
  alert("Максимум 10 фото (файлы + ссылки)");
  unblockBtn();
  return;
}

if (!name) {
  alert("Введи название транспортного средства");
  unblockBtn();
  return;
}

if (!price) {
  alert("Введи цену");
  unblockBtn();
  return;
}

if (!hasFile && !hasLink) {
  alert("Добавь хотя бы одно фото");
  unblockBtn();
  return;
}

if (!game && !phone && !tg && !discord && !vk) {
  alert("Укажи хотя бы один контакт");
  unblockBtn();
  return;
}

  // 📁 ЕСЛИ ФАЙЛ
  let images = [];
  let loaded = 0;

  // 👉 если есть файлы
  if (hasFile) {
    selectedFiles.forEach(file => {

      // ✅ если это уже base64
      if (typeof file === "object" && file.type === "base64") {
         images.push({ type: "file", value: file.value });
         loaded++;

        if (loaded === selectedFiles.length) {
          finish();
        }
        return;
      }

      // ✅ если это настоящий файл
      const reader = new FileReader();

      reader.onload = function(e) {
        images.push({ type: "file", value: e.target.result });
        loaded++;

        if (loaded === selectedFiles.length) {
          finish();
        }
      };

      reader.readAsDataURL(file);
    });
  } else {
    finish();
  }

  // 👉 финальная сборка
  function finish() {
      if (hasLink) {
        links.forEach(link => images.push({ type: "link", value: link }));
      }

      saveCar(images);
    }

    async function saveCar(images) {
        const carData = {
          name,
          price,
          fuel: selectedFuel,
          mileage,
          plate,
          condition: selectedCondition || "Неопределённое",
          rating: rating ? Number(rating) : "",
          comment: (document.getElementById("commentInput")?.value || "").trim() || "",
          images,
          server,
          owner: currentUser ? currentUser.id : userId,
          contacts: { tg, discord, vk, game, phone }
        };

        try {
          if (editingCarId) {
            const car = cars.find(c => c.id == editingCarId);
            if (car) {
              await updateCar(car.firestoreId, carData);
            }
            localStorage.removeItem("editingCarId");
            editingCarId = null;
            resetForm();
          } else {
            carData.id = Date.now() + Math.random();
            carData.createdAt = new Date().toISOString();
            await saveCarToFirebase(carData);
          }

          selectedFiles = [];
          fileInput.value = "";

          if (submitBtn) {
           submitBtn.disabled = false;
           submitBtn.innerText = editingCarId ? "Сохранить изменения" : "Разместить объявление";
           submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
         }

window.location.href = "index.html";

        } catch (e) {
  alert("Ошибка сохранения: " + e.message);
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerText = editingCarId ? "Сохранить изменения" : "Разместить объявление";
    submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }
}
      }
}


let deletingInProgress = false;

async function deleteCarById(id) {
  if (deletingInProgress) return;

  const car = cars.find(c => c.id === id);
  if (!car) return;

  if (!confirm("Удалить объявление?")) return;

  deletingInProgress = true;

  try {
    await deleteCarFromFirebase(car.firestoreId);
    cars = cars.filter(c => c.id !== id);
    closeModal();
    renderCars();
  } catch (e) {
    alert("Ошибка удаления: " + e.message);
  } finally {
    deletingInProgress = false;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentPage = 1;
      renderCars();

      if (searchInput.value.length > 0) {
        clearBtn.classList.remove("hidden");
      } else {
        clearBtn.classList.add("hidden");
      }
    });
  }
});

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("serverDropdown");
  const arrow = document.getElementById("serverArrow");

  if (!dropdown) return;

  // кнопка открытия на index.html
  const buttonMain = document.querySelector("button[onclick='toggleServerDropdown()']");
  // кнопка открытия на create.html
  const buttonForm = document.getElementById("serverButton");

  const clickedInsideDropdown = dropdown.contains(e.target);
  const clickedButtonMain = buttonMain && buttonMain.contains(e.target);
  const clickedButtonForm = buttonForm && buttonForm.contains(e.target);

  if (!clickedInsideDropdown && !clickedButtonMain && !clickedButtonForm) {
    dropdown.classList.add("hidden");
    if (arrow) arrow.innerText = "▼";
    highlightItem(-1);
  }
});

function clearSearch() {
  const input = document.getElementById("searchInput");
  input.value = "";
  renderCars();

  document.getElementById("clearSearch").classList.add("hidden");
}

function toggleMyCars() {
  showOnlyMyCars = !showOnlyMyCars;

  const myBtn = document.getElementById("myCarsBtn");
  const favBtn = document.getElementById("favBtn");

  if (showOnlyMyCars) {
    myBtn.classList.add("text-red-600");
    myBtn.classList.remove("text-white");

    // ❗ сбрасываем "Избранное"
    showFavoritesOnly = false;
    favBtn.classList.remove("text-red-600");
    favBtn.classList.add("text-white");

  } else {
    myBtn.classList.remove("text-red-600");
    myBtn.classList.add("text-white");
  }

  currentPage = 1;
  renderCars();
}

function formatPrice(input) {
  let value = input.value.replace(/\D/g, "");
  if (value.length > 20) {
    value = value.slice(0, 20);
  }

  // формат
  value = value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  input.value = value;

  const symbol = document.getElementById("priceSymbol");

  // считаем ширину текста
  const temp = document.createElement("span");
  temp.style.visibility = "hidden";
  temp.style.position = "absolute";
  temp.style.whiteSpace = "pre";
  temp.style.font = getComputedStyle(input).font;
  temp.innerText = value || "";

  document.body.appendChild(temp);

  const width = temp.offsetWidth;
  document.body.removeChild(temp);

  // двигаем ₽
  symbol.style.left = (width + 18) + "px";

  // скрытие если пусто
  if (!value) {
    symbol.style.display = "none";
  } else {
    symbol.style.display = "block";
  }
}

const mileageInput = document.getElementById("mileageInput");

if (mileageInput) {
  mileageInput.addEventListener("input", () => {
    let value = mileageInput.value.replace(/\D/g, "");

    // 🔴 лимит 6 цифр (999999)
    if (value.length > 6) {
      value = value.slice(0, 6);
    }

    // формат
    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    mileageInput.value = value;

        const clearMileage = document.getElementById("clearMileage");
        if (clearMileage) clearMileage.classList.toggle("hidden", !value);

        const symbol = document.getElementById("kmSymbol");

    if (!value) {
      symbol.style.display = "none";
      return;
    }

    symbol.style.display = "block";

    // двигаем км
    const temp = document.createElement("span");
    temp.style.visibility = "hidden";
    temp.style.position = "absolute";
    temp.style.whiteSpace = "pre";
    temp.style.font = getComputedStyle(mileageInput).font;
    temp.innerText = value;

    document.body.appendChild(temp);
    const width = temp.offsetWidth;
    document.body.removeChild(temp);

    symbol.style.left = (width + 18) + "px";
        symbol.style.top = "50%";
        symbol.style.transform = "translateY(-5%)";
  });
}

function toggleContacts() {
  const block = document.getElementById("modalContacts");
  const btn = document.getElementById("contactsBtn");

  if (block.classList.contains("hidden")) {
      block.classList.remove("hidden");
      btn.innerText = " Закрыть контакты";
      btn.classList.add("bg-neutral-800", "hover:bg-neutral-700");
      btn.classList.remove("bg-red-600", "hover:bg-red-600");
      setTimeout(() => {
            const modal = document.getElementById("modal");
            modal.scrollTo({ top: modal.scrollHeight, behavior: "smooth" });
          }, 100);
    } else {
      block.classList.add("hidden");
      btn.innerText = " Связаться с игроком";
      btn.classList.remove("bg-neutral-800", "hover:bg-neutral-700");
      btn.classList.add("bg-red-600", "hover:bg-red-600");
    }
  }
function selectFuel(value, el) {
  selectedFuel = value;

  document.querySelectorAll(".fuelBtn").forEach(btn => {
    btn.classList.remove("bg-red-600", "active");
    btn.classList.add("bg-neutral-800");

    btn.classList.add("hover:bg-neutral-700");
  });

  el.classList.remove("bg-neutral-800", "hover:bg-neutral-700");
  el.classList.add("bg-red-600", "active");
}

function selectCondition(value, el) {
  selectedCondition = value;

  document.querySelectorAll(".condition-btn").forEach(btn => {
    btn.classList.remove("bg-red-600", "active");
    btn.classList.add("bg-neutral-800", "hover:bg-neutral-700");
  });

  el.classList.remove("bg-neutral-800", "hover:bg-neutral-700");
  el.classList.add("bg-red-600", "active");

  // 👉 рейтинг (перенесли сюда)
  const ratingBlock = document.getElementById("ratingBlock");

  if (ratingBlock) {
    if (value === "Неопределённое") {
      ratingBlock.classList.add("hidden");
    } else {
      ratingBlock.classList.remove("hidden");
    }
  }
}

function toggleExtraContacts() {
  const block = document.getElementById("extraContacts");
  const arrow = document.getElementById("arrow");
  const btn = document.querySelector("button[onclick='toggleExtraContacts()']");

  if (block.classList.contains("hidden")) {
    block.classList.remove("hidden");
    arrow.innerText = "▲";
    btn.classList.add("border-red-600", "ring-1", "ring-red-600");
    btn.classList.remove("border-neutral-700");
  } else {
    block.classList.add("hidden");
    arrow.innerText = "▼";
    btn.blur();
    btn.classList.remove("border-red-600", "ring-1", "ring-red-600");
    btn.classList.add("border-neutral-700");
  }
}

function goBack() {
  if (editingCarId) {
    const confirmLeave = confirm("Выйти из редактирования? Изменения не сохранятся.");
    if (!confirmLeave) return;
  } else {
    const confirmLeave = confirm("Выйти? Объявление не будет опубликовано.");
    if (!confirmLeave) return;
  }
  localStorage.removeItem("editingCarId");
  window.location.href = "index.html";
}

let imageMode = "file";

function setImageMode(mode) {
  imageMode = mode;

  const lastFocused = document.activeElement;

  const fileInput = document.getElementById("fileInput");
  const linkBlock = document.getElementById("linkBlock");
  const fileBtn = document.getElementById("fileBtn");
  const linkBtn = document.getElementById("linkBtn");

  if (mode === "file") {
    linkBlock.classList.add("hidden");
    document.querySelector("label[for='fileInput']")?.classList.remove("hidden");

    fileBtn.classList.add("bg-red-600", "text-white", "active");
    fileBtn.classList.remove("bg-neutral-800");
    fileBtn.onmouseover = null;
    fileBtn.onmouseout = null;
    fileBtn.style.backgroundColor = "";

    linkBtn.classList.remove("bg-red-600", "text-white", "active");
    linkBtn.classList.add("bg-neutral-800");
    linkBtn.onmouseover = () => linkBtn.style.backgroundColor = "rgb(239 68 68)";
    linkBtn.onmouseout = () => linkBtn.style.backgroundColor = "";

  } else {
      linkBlock.classList.remove("hidden");
      document.querySelector("label[for='fileInput']")?.classList.add("hidden");

      linkBtn.classList.add("bg-red-600", "text-white", "active");
      linkBtn.classList.remove("bg-neutral-800");
      linkBtn.onmouseover = null;
      linkBtn.onmouseout = null;
      linkBtn.style.backgroundColor = "";

      fileBtn.classList.remove("bg-red-600", "text-white", "active");
      fileBtn.classList.add("bg-neutral-800");
      fileBtn.onmouseover = () => fileBtn.style.backgroundColor = "rgb(239 68 68)";
      fileBtn.onmouseout = () => fileBtn.style.backgroundColor = "";
    }

  if (mode === "link") {
    setTimeout(() => {
      const firstLink = document.querySelector(".imageLink");
      if (firstLink) firstLink.focus();
    }, 50);
  }
}

const fileInput = document.getElementById("fileInput");
const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("previewContainer");

// DRAG & DROP
const dropZone = document.getElementById("dropZone");
if (dropZone) {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#dc2626";
    dropZone.style.backgroundColor = "#292929";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "";
    dropZone.style.backgroundColor = "";
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "";
    dropZone.style.backgroundColor = "";

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));

    if (!files.length) return;

    if (selectedFiles.length + files.length > 5) {
      alert("Максимум 5 файлов");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement("canvas");
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.9);
          selectedFiles.push({ type: "base64", value: compressed });
          renderPreview();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  });
}

// файл (несколько)
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files);

    // ❗ лимит 5 файлов
    if (selectedFiles.length + files.length > 5) {
      alert("Можно загрузить максимум 5 файлов");
      return;
    }

    // ❗ считаем ссылки
    const linkInputs = document.querySelectorAll(".imageLink");
    let linksCount = 0;

    linkInputs.forEach(input => {
      if (input.value.trim() !== "") linksCount++;
    });

    // ❗ общий лимит 10
    if (selectedFiles.length + files.length + linksCount > 10) {
      alert("Максимум 10 фото (файлы + ссылки)");
      return;
    }

    files.forEach(file => {
          const reader = new FileReader();
          reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
              const canvas = document.createElement("canvas");
              const MAX = 800;
              let w = img.width;
              let h = img.height;
              if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
              canvas.width = w;
              canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL("image/jpeg", 0.9);
              selectedFiles.push({ type: "base64", value: compressed });
              renderPreview();
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });

        fileInput.value = "";
  });
}

// рендер превью
function renderPreview() {
  const previewContainer = document.getElementById("previewContainer");
  if (!previewContainer) return;

  previewContainer.innerHTML = "";

  let hasImages = false;

  // 📎 ФАЙЛЫ
  selectedFiles.forEach((file, index) => {
    hasImages = true;

    const wrapper = document.createElement("div");
    wrapper.className = "relative";

    const img = document.createElement("img");
        if (typeof file === "object" && file.type === "base64") {
          img.src = file.value;
        } else if (file instanceof File) {
          img.src = URL.createObjectURL(file);
        } else {
          img.src = "";
        }
        img.className = "w-28 h-28 object-cover rounded shrink-0";

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "✕";
    removeBtn.title = "Удалить фото";
    removeBtn.className = `
      absolute top-1 right-1
      bg-black/70 text-white
      w-7 h-7 rounded-full
      flex items-center justify-center
      hover:bg-red-600
      text-sm leading-none hover:scale-110 transition
    `;

    removeBtn.onclick = () => {
      selectedFiles.splice(index, 1);
      renderPreview();
    };

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    previewContainer.appendChild(wrapper);
  });

  // 🔗 ССЫЛКИ
  const linkInputs = document.querySelectorAll(".imageLink");

  linkInputs.forEach((input) => {
    const url = input.value.trim();

    if (!url) return;

    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("data:image")
    ) return;

    hasImages = true;

    const wrapper = document.createElement("div");
    wrapper.className = "relative";

    const img = document.createElement("img");
    img.src = url;
    img.className = "w-28 h-28 object-cover rounded shrink-0";

    img.onerror = () => {
      img.src = "https://placehold.co/100x100?text=Ошибка";
    };

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "✕";
    removeBtn.title = "Удалить фото";
    removeBtn.className = `
      absolute top-1 right-1
      bg-black/70 text-white
      w-7 h-7 rounded-full
      flex items-center justify-center
      hover:bg-red-600
      text-sm leading-none hover:scale-110 transition
    `;

    removeBtn.onclick = () => {
          input.value = "";
          const allInputs = document.querySelectorAll(".imageLink");
          if (allInputs[0] === input) {
            const clearBtn = input.nextElementSibling;
            if (clearBtn) clearBtn.classList.add("hidden");
          }
          renderPreview();
        };

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    previewContainer.appendChild(wrapper);
  });

  // показать/скрыть
  if (hasImages) {
    previewContainer.classList.remove("hidden");
  } else {
    previewContainer.classList.add("hidden");
    updateScrollButtons();
  }
}

// ссылка
if (imageInput) {
  imageInput.addEventListener("input", () => {
    if (imageInput.value.startsWith("http")) {
    }
  });
}

function outsideClick(e) {
  const modalContent = document.querySelector("#modal > div");

  if (!modalContent.contains(e.target)) {
    closeModal();
  }
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {

    const auth = document.getElementById("authModal");
    const modal = document.getElementById("modal");
    const lb = document.getElementById("lightbox");

    if (lb && !lb.classList.contains("hidden")) {
      closeLightbox();
    } else if (auth && !auth.classList.contains("hidden")) {
      closeAuth();
    } else if (modal && !modal.classList.contains("hidden")) {
      closeModal();
    } else if (document.getElementById("nameInput")) {
      goBack();
    }
  }
});
function addLinkInput() {
  const existingLinks = document.querySelectorAll(".imageLink").length;

  if (existingLinks >= 5) {
    alert("Можно добавить максимум 5 ссылок");
    return;
  }
  const container = document.getElementById("linksContainer");

  const wrapper = document.createElement("div");
  wrapper.className = "relative";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Вставь ссылку на фото";
  input.className = "imageLink w-full p-3 pr-12 rounded-lg bg-black border-2 border-neutral-700 hover:border-red-600 focus:border-red-600 outline-none text-white";
  input.addEventListener("input", handleLinkPreview);


  // ❌ крестик удаления поля
  const removeBtn = document.createElement("button");
  removeBtn.innerHTML = "✕";
  removeBtn.title = "Удалить фото";
  removeBtn.className = `absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full w-7 h-7 text-sm hover:bg-red-600 hover:scale-110 transition`;

  removeBtn.onclick = () => {
    wrapper.remove();
    handleLinkPreview();
  };

  wrapper.appendChild(input);
  wrapper.appendChild(removeBtn);
  container.appendChild(wrapper);
}

function handleLinkPreview() {
  const linkInputs = document.querySelectorAll(".imageLink");

  let linksCount = 0;

  linkInputs.forEach(input => {
    const val = input.value.trim();

    // ✅ считаем только реальные ссылки
    if (
      val &&
      (val.startsWith("http://") ||
       val.startsWith("https://") ||
       val.startsWith("data:image"))
    ) {
      linksCount++;
    }
  });

  if (linksCount > 5) {
    alert("Максимум 5 ссылок");
    return;
  }

  if (selectedFiles.length + linksCount > 10) {
    alert("Максимум 10 фото (файлы + ссылки)");
    return;
  }

  renderPreview();
}

document.addEventListener("input", function(e) {
  if (e.target.classList.contains("imageLink")) {
    handleLinkPreview();
  }
});

const scrollLeftBtn = document.getElementById("scrollLeftBtn");
const scrollRightBtn = document.getElementById("scrollRightBtn");

function updateScrollButtons() {
  const container = document.getElementById("previewContainer");
  const scrollLeftBtn = document.getElementById("scrollLeftBtn");
  const scrollRightBtn = document.getElementById("scrollRightBtn");

  if (!container || !scrollLeftBtn || !scrollRightBtn) return;

  const hasOverflow = container.scrollWidth > container.clientWidth;

  if (hasOverflow) {
    scrollLeftBtn.classList.remove("hidden");
    scrollRightBtn.classList.remove("hidden");
  } else {
    scrollLeftBtn.classList.add("hidden");
    scrollRightBtn.classList.add("hidden");
  }
}

if (scrollLeftBtn && scrollRightBtn) {
  scrollLeftBtn.onclick = () => {
    previewContainer.scrollBy({ left: -150, behavior: "smooth" });
  };

  scrollRightBtn.onclick = () => {
    previewContainer.scrollBy({ left: 150, behavior: "smooth" });
  };
}

let selectedServer = "Все серверы";

let selectedServerForm = "";

function selectServerForm(server, e) {
  if (e) e.stopPropagation();

  selectedServerForm = server;

  const text = document.getElementById("selectedServerTextForm");
  if (text) text.innerText = server;

  const items = document.querySelectorAll("#serverDropdown .dropdownItem");

  // снимаем у всех
  items.forEach(item => {
    item.classList.remove("bg-red-600", "text-white");
  });

  // добавляем ТОЛЬКО тому, по которому кликнули
  for (let item of items) {
    if (item.innerText === server) {
      item.classList.add("bg-red-600", "text-white");
      break;
    }
  }

  const dropdown = document.getElementById("serverDropdown");
  if (dropdown) dropdown.classList.add("hidden");

  const arrow = document.getElementById("serverArrow");
  if (arrow) arrow.innerText = "▼";
}

function toggleServerDropdown() {
  const dropdown = document.getElementById("serverDropdown");
  const arrow = document.getElementById("serverArrow");

  if (!dropdown) return;

  dropdown.classList.toggle("hidden");

  if (arrow) {
    arrow.innerText = dropdown.classList.contains("hidden") ? "▼" : "▲";
  }

  // сбрасываем подсветку при открытии
  if (!dropdown.classList.contains("hidden")) {
    highlightedIndex = -1;
    highlightItem(-1);
  }
}

// ===== СТРЕЛКИ + СИНХРОНИЗАЦИЯ МЫШИ =====
let highlightedIndex = -1;

function getDropdownItems() {
  const dropdown = document.getElementById("serverDropdown");
  if (!dropdown) return [];
  return Array.from(dropdown.querySelectorAll(".dropdownItem"));
}

function highlightItem(index) {
  const items = getDropdownItems();
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add("bg-red-600", "text-white");
    } else {
      item.classList.remove("bg-red-600", "text-white");
    }
  });
  highlightedIndex = index;
}

document.addEventListener("keydown", function(e) {
  const dropdown = document.getElementById("serverDropdown");
  if (!dropdown || dropdown.classList.contains("hidden")) return;

  const items = getDropdownItems();

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = (highlightedIndex + 1) % items.length;
    highlightItem(next);
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = (highlightedIndex - 1 + items.length) % items.length;
    highlightItem(prev);
  }

  if (e.key === "Enter") {
    e.preventDefault();
    if (highlightedIndex >= 0 && items[highlightedIndex]) {
      items[highlightedIndex].click();
    }
  }
});

function selectServer(server, e) {
  if (e) e.stopPropagation();

  selectedServer = server;

  const text = document.getElementById("selectedServerText");
  if (text) text.innerText = server;

  // снимаем выделение
  document.querySelectorAll("#serverDropdown .dropdownItem").forEach(item => {
    item.classList.remove("bg-red-600", "text-white");
  });

  // выделяем выбранный
  if (e && e.currentTarget) {
    e.currentTarget.classList.add("bg-red-600", "text-white");
  }

  // закрываем dropdown
  const dropdown = document.getElementById("serverDropdown");
  if (dropdown) dropdown.classList.add("hidden");

  // стрелка вниз
  const arrow = document.getElementById("serverArrow");
  if (arrow) arrow.innerText = "▼";

  // обновляем список
  currentPage = 1;
  renderCars();
}

function toggleFavorite(carId, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  if (!currentUser) {
    alert("Войди в аккаунт чтобы добавить в избранное");
    openAuth("login");
    return;
  }

  if (favorites.includes(carId)) {
    favorites = favorites.filter(id => id !== carId);
  } else {
    favorites.push(carId);
  }

  if (userId) localStorage.setItem(`favorites_${userId}`, JSON.stringify(favorites));

  renderCars(); // обновляем карточки

  // ✅ ВОТ ЭТО ДОБАВЬ
  const heart = document.querySelector("#modalTitle .fav-heart");

  if (heart) {
    const isFavNow = favorites.includes(carId);

    heart.innerHTML = `
      <!-- tooltip -->
      <span class="absolute -top-8 left-1/2 -translate-x-1/2
                   bg-black text-white text-xs px-2 py-1 rounded
                   opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
        ${isFavNow ? "Убрать из избранного" : "Добавить в избранное"}
      </span>

      <!-- svg -->
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24"
           class="w-7 h-7 transition duration-200 ${
             isFavNow
               ? "text-red-600"
               : "text-gray-400 hover:text-red-600 active:text-red-600"
           }"
           fill="currentColor">
        <path d="M16.444 3.5C19.513 3.5 22 6.002 22 9.088a5.6 5.6 0 0 1-1.723 4.045L12 22.5l-8.276-9.365A5.6 5.6 0 0 1 2 9.088C2 6.002 4.487 3.5 7.556 3.5c1.817 0 3.43.878 4.444 2.235A5.54 5.54 0 0 1 16.444 3.5"></path>
      </svg>
    `;
  }
}

function toggleFavoritesFilter() {
  showFavoritesOnly = !showFavoritesOnly;

  const favBtn = document.getElementById("favBtn");
  const myBtn = document.getElementById("myCarsBtn");

  if (showFavoritesOnly) {
    favBtn.classList.add("text-red-600");
    favBtn.classList.remove("text-white");

    // ❗ сбрасываем "Мои объявления"
    showOnlyMyCars = false;
    myBtn.classList.remove("text-red-600");
    myBtn.classList.add("text-white");

  } else {
    favBtn.classList.remove("text-red-600");
    favBtn.classList.add("text-white");
  }

  currentPage = 1;
  renderCars();
}

function editCar(id) {
  const confirmEdit = confirm("Перейти к редактированию объявления?");

  if (!confirmEdit) return;

  localStorage.setItem("editingCarId", id);
  window.location.href = "create.html";
}

window.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("nameInput")) return;

  const editingId = localStorage.getItem("editingCarId");

  if (!editingId) return;

  editingCarId = editingId;

  // показываем оверлей загрузки
  const overlay = document.createElement("div");
  overlay.id = "loadingOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 9999;
  `;
  overlay.innerHTML = `
    <div style="
      width: 48px; height: 48px;
      border: 4px solid #404040;
      border-top-color: #dc2626;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    "></div>
    <p style="color: white; font-size: 14px;">Загружаем данные...</p>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;
  document.body.appendChild(overlay);

  // ждём пока Firebase загрузит машины
  let car = cars.find(c => c.id == editingId);

  if (!car) {
    try {
      const allCars = await getCars();
      car = allCars.find(c => c.id == editingId);
      cars = allCars;
    } catch(e) {
      console.error("Ошибка загрузки:", e);
    }
  }

  // убираем оверлей
  overlay.remove();

  if (!car) return;

  // 👉 основные поля
  document.getElementById("nameInput").value = car.name || "";
  document.getElementById("priceInput").value = car.price || "";
  document.getElementById("mileageInput").value = car.mileage || "";
  // триггерим символы ₽ и км
if (car.price) {
  const priceInput = document.getElementById("priceInput");
  formatPrice(priceInput);
}

if (car.mileage) {
  document.getElementById("mileageInput").dispatchEvent(new Event("input"));
}
  document.getElementById("plateInput").value = car.plate || "";
  document.getElementById("commentInput").value = car.comment || "";

  // показываем крестики если поля заполнены
  ["nameInput", "plateInput", "commentInput"].forEach(id => {
    const el = document.getElementById(id);
    const clearId = "clear" + id.charAt(0).toUpperCase() + id.slice(1, -5) + (id.includes("comment") ? "Comment" : "");
    if (el && el.value) el.dispatchEvent(new Event("input"));
  });

  document.getElementById("clearName").classList.toggle("hidden", !car.name);
  document.getElementById("clearPlate").classList.toggle("hidden", !car.plate);
  document.getElementById("clearComment").classList.toggle("hidden", !car.comment);
  document.getElementById("clearPrice").classList.toggle("hidden", !car.price);
  document.getElementById("clearMileage").classList.toggle("hidden", !car.mileage);

  // 👉 рейтинг
  if (car.rating) {
    const ratingInput = document.getElementById("ratingInput");
    if (ratingInput) {
      ratingInput.value = car.rating;
      document.getElementById("clearRating").classList.remove("hidden");
    }
  }

  // 👉 контакты
  if (car.contacts) {
    document.getElementById("gameInput").value = car.contacts.game || "";
    document.getElementById("phoneInput").value = car.contacts.phone || "";
    document.getElementById("tgInput").value = car.contacts.tg || "";
    document.getElementById("discordInput").value = car.contacts.discord || "";
    document.getElementById("vkInput").value = car.contacts.vk || "";

    document.getElementById("clearGame").classList.toggle("hidden", !car.contacts.game);
    document.getElementById("clearPhone").classList.toggle("hidden", !car.contacts.phone);
    document.getElementById("clearTg").classList.toggle("hidden", !car.contacts.tg);
    document.getElementById("clearDiscord").classList.toggle("hidden", !car.contacts.discord);
    document.getElementById("clearVk").classList.toggle("hidden", !car.contacts.vk);
  }

  // 👉 сервер
  selectedServerForm = car.server;
  document.getElementById("selectedServerTextForm").innerText = car.server || "Выберите сервер";

  // 👉 топливо
  if (car.fuel) {
    document.querySelectorAll(".fuelBtn").forEach(btn => {
      if (btn.innerText === car.fuel) {
        selectFuel(car.fuel, btn);
      }
    });
  }

  // 👉 состояние
  if (car.condition) {
    document.querySelectorAll(".condition-btn").forEach(btn => {
      if (btn.innerText === car.condition) {
        selectCondition(car.condition, btn);
      }
    });
  }

  // 👉 ФОТО (ссылки)
  // 👉 ФОТО (разделяем файлы и ссылки)
  if (car.images && car.images.length > 0) {
    const container = document.getElementById("linksContainer");
        container.innerHTML = "";

        selectedFiles = [];

        const linkImages = car.images.filter(img => (img.type || "link") === "link");
            const fileImages = car.images.filter(img => img.type === "file");

            fileImages.forEach(img => {
              selectedFiles.push({ type: "base64", value: img.value || img });
            });

            if (linkImages.length > 0) {
              linkImages.forEach((img, idx) => {
                  const wrapper = document.createElement("div");
                  wrapper.className = "relative";
                  const input = document.createElement("input");
                  input.type = "text";
                  input.value = img.value || img;
                  input.placeholder = "Вставь ссылку на фото";
                  input.className = "imageLink w-full p-3 pr-12 rounded-lg bg-black border-2 border-neutral-700 hover:border-red-600 focus:border-red-600 outline-none text-white";
                  input.addEventListener("input", handleLinkPreview);
                  const removeBtn = document.createElement("button");
                  removeBtn.innerHTML = "✕";
                  removeBtn.className = "absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full w-7 h-7 text-sm hover:bg-red-600 hover:scale-110 transition";
                  if (idx === 0) {
                    removeBtn.onclick = () => { input.value = ""; removeBtn.classList.add("hidden"); handleLinkPreview(); };
                  } else {
                    removeBtn.onclick = () => { wrapper.remove(); handleLinkPreview(); };
                  }
                  input.addEventListener("input", () => removeBtn.classList.toggle("hidden", input.value.length === 0));
                  wrapper.appendChild(input);
                  wrapper.appendChild(removeBtn);
                  container.appendChild(wrapper);
                });
              setImageMode("link");
            } else {
              const wrapper = document.createElement("div");
              wrapper.className = "relative";
              const input = document.createElement("input");
              input.type = "text";
              input.placeholder = "Вставь ссылку на фото";
              input.className = "imageLink w-full p-3 pr-12 rounded-lg bg-black border-2 border-neutral-700 hover:border-red-600 focus:border-red-600 outline-none text-white";
              input.addEventListener("input", handleLinkPreview);
              const btn = document.createElement("button");
              btn.innerHTML = "✕";
              btn.className = "absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full w-7 h-7 text-sm hover:bg-red-600 hover:scale-110 transition hidden";
              btn.onclick = () => { input.value = ""; btn.classList.add("hidden"); renderPreview(); };
              input.addEventListener("input", () => btn.classList.toggle("hidden", input.value.length === 0));
              wrapper.appendChild(input);
              wrapper.appendChild(btn);
              container.appendChild(wrapper);
              setImageMode("file");
            }

            setTimeout(() => { renderPreview(); }, 0);
  }
});

function resetForm() {
  const ids = [
    "nameInput",
    "priceInput",
    "mileageInput",
    "plateInput",
    "commentInput",
    "ratingInput",
    "gameInput",
    "phoneInput",
    "tgInput",
    "discordInput",
    "vkInput"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  selectedFuel = "";
  selectedCondition = "";
  selectedServerForm = "";

  const serverText = document.getElementById("selectedServerTextForm");
  if (serverText) serverText.innerText = "Выберите сервер";

  selectedFiles = [];

  const preview = document.getElementById("previewContainer");
  if (preview) preview.innerHTML = "";
}

function shareCar() {
  if (!currentCarId) return;

  const link = `${window.location.origin}/index.html?id=${currentCarId}`;

  navigator.clipboard.writeText(link)
    .then(() => {
      alert("Ссылка скопирована!");
    })
    .catch(() => {
      prompt("Скопируй ссылку:", link);
    });
}

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (id) {
    // ждём пока Firebase загрузит машины
    const interval = setInterval(() => {
      const car = cars.find(c => c.id == id);
      if (car) {
        clearInterval(interval);
        openModal(car);
      }
    }, 300);

    // стоп через 10 секунд если не нашли
    setTimeout(() => clearInterval(interval), 10000);
  }
});


let currentUser = null;

function openAuth(mode = "login") {
  authMode = mode;

  // очищаем поля при открытии
  document.getElementById("loginInput").value = "";
  document.getElementById("passwordInput").value = "";

  // сбрасываем глазик пароля
  document.getElementById("eyeOpen").classList.add("hidden");
  document.getElementById("eyeClosed").classList.remove("hidden");
  document.getElementById("passwordInput").type = "password";

  document.getElementById("authModal").classList.remove("hidden");
  document.getElementById("authModal").classList.add("flex");

  // предупреждение при регистрации
  const warningBlock = document.getElementById("authWarning");
  if (warningBlock) {
    if (mode === "register") {
      warningBlock.classList.remove("hidden");
    } else {
      warningBlock.classList.add("hidden");
    }
  }

  document.getElementById("authSubmitBtn").innerText =
    mode === "login" ? "Войти" : "Создать аккаунт";

  document.getElementById("switchAuth").innerText =
    mode === "login"
      ? "Нет аккаунта? Зарегистрироваться"
      : "Уже есть аккаунт? Войти";

  // показываем чекбокс только при входе
  const rememberBlock = document.getElementById("rememberBlock");
  if (rememberBlock) {
    if (mode === "login") {
      rememberBlock.classList.remove("hidden");
    } else {
      rememberBlock.classList.add("hidden");
    }
  }
}

function closeAuth() {
  const modal = document.getElementById("authModal");

  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function toggleAuthMode() {
  authMode = authMode === "login" ? "register" : "login";

  document.getElementById("authTitle").innerText =
    authMode === "login" ? "Вход" : "Регистрация";

  document.querySelector("#authModal button").innerText =
    authMode === "login" ? "Войти" : "Создать аккаунт";

  document.getElementById("switchAuth").innerText =
    authMode === "login"
      ? "Нет аккаунта? Зарегистрироваться"
      : "Уже есть аккаунт? Войти";
}

async function submitAuth() {
  const login = document.getElementById("loginInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

if (!login || !password) {
    alert("Заполни поля");
    return;
}

if (/[а-яёА-ЯЁ\s]/.test(login)) {
    alert("Логин должен содержать только латинские буквы, цифры и символы");
    return;
}

if (authMode === "register") {
    if (password.length < 6) {
        alert("Минимум 6 символов");
        return;
    }
    if (/[а-яёА-ЯЁ]/.test(password)) {
        alert("Пароль должен содержать только латинские буквы и цифры");
        return;
    }
    if (/^(.)\1+$/.test(password)) {
        alert("Пароль слишком простой — не используй одинаковые символы");
        return;
    }
    if (["123456", "111111", "000000", "123123", "qwerty", "password"].includes(password.toLowerCase())) {
        alert("Пароль слишком простой — придумай сложнее");
        return;
    }
}

  const btn = document.getElementById("authSubmitBtn");
btn.disabled = true;
btn.innerText = "Подождите...";

try {
    if (authMode === "register") {
      await registerUser(login, password);
      btn.disabled = false;
      btn.innerText = "Создать аккаунт";
      closeAuth();
    } else {
      const remember = document.getElementById("rememberMe")?.checked || false;
      await loginUser(login, password, remember);
      btn.disabled = false;
      btn.innerText = "Войти";
      closeAuth();
    }
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      alert("Пользователь уже существует");
    } else if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
      alert("Неверный логин или пароль");
    } else if (e.code === "auth/weak-password") {
      alert("Пароль слишком короткий — минимум 6 символов");
    } else {
      alert("Ошибка: " + e.message);
    }

    btn.disabled = false;
    btn.innerText = authMode === "login" ? "Войти" : "Создать аккаунт";
  }
}

async function logout() {
  await logoutUser();
  favorites = [];
  renderCars();
}

function authOutsideClick(e) {
  const content = document.querySelector("#authModal > form") || document.querySelector("#authModal > div");

  if (!content || !content.contains(e.target)) {
    closeAuth();
  }
}

function togglePassword() {
  const input = document.getElementById("passwordInput");
  const eyeOpen = document.getElementById("eyeOpen");
  const eyeClosed = document.getElementById("eyeClosed");

  if (input.type === "password") {
    input.type = "text";

    eyeOpen.classList.remove("hidden");
    eyeClosed.classList.add("hidden");

  } else {
    input.type = "password";

    eyeOpen.classList.add("hidden");
    eyeClosed.classList.remove("hidden");
  }
}

// ===== LIGHTBOX =====
let lightboxImages = [];
let lightboxIndex = 0;

function openLightbox() {
  lightboxImages = currentLightboxImages || [];
  lightboxIndex = currentLightboxIndex || 0;

  if (lightboxImages.length === 0) return;

  const lb = document.getElementById("lightbox");
  lb.classList.remove("hidden");
  lb.classList.add("flex");

  showLightboxImage();
}

function showLightboxImage() {
  const img = document.getElementById("lightboxImg");
  const counter = document.getElementById("lightboxCounter");
  const lbPrev = document.getElementById("lbPrev");
  const lbNext = document.getElementById("lbNext");

  img.src = lightboxImages[lightboxIndex];
  counter.innerHTML = `<span class="text-red-600">${lightboxIndex + 1}</span> / ${lightboxImages.length}`;

  lbPrev.style.display = lightboxImages.length <= 1 || lightboxIndex === 0 ? "none" : "flex";
  lbNext.style.display = lightboxImages.length <= 1 || lightboxIndex === lightboxImages.length - 1 ? "none" : "flex";

  // клик по половинам картинки
  img.onclick = (e) => {
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    if (clickX < rect.width / 2) {
      if (lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); }
    } else {
      if (lightboxIndex < lightboxImages.length - 1) { lightboxIndex++; showLightboxImage(); }
    }
  };

  // наведение — подсветка стрелок
  img.onmousemove = (e) => {
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;

    lbPrev.classList.remove("!text-red-600", "!scale-110");
    lbNext.classList.remove("!text-red-600", "!scale-110");

    if (x < rect.width / 2) {
      lbPrev.classList.add("!text-red-600", "!scale-110");
    } else {
      lbNext.classList.add("!text-red-600", "!scale-110");
    }
  };

  img.onmouseleave = () => {
    lbPrev.classList.remove("!text-red-600", "!scale-110");
    lbNext.classList.remove("!text-red-600", "!scale-110");
  };
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  lb.classList.add("hidden");
  lb.classList.remove("flex");
}

document.getElementById("lbPrev")?.addEventListener("click", () => {
  if (lightboxIndex > 0) {
    lightboxIndex--;
    showLightboxImage();
  }
});

document.getElementById("lbNext")?.addEventListener("click", () => {
  if (lightboxIndex < lightboxImages.length - 1) {
    lightboxIndex++;
    showLightboxImage();
  }
});

document.addEventListener("keydown", (e) => {
  const lb = document.getElementById("lightbox");
  if (!lb || lb.classList.contains("hidden")) return;

  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft" && lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); }
  if (e.key === "ArrowRight" && lightboxIndex < lightboxImages.length - 1) { lightboxIndex++; showLightboxImage(); }
});

function toggleNoPlate() {
  const input = document.getElementById("plateInput");
  const btn = document.getElementById("noPlateBtn");
  const clearBtn = document.getElementById("clearPlate");

  if (input.value === "Без номера") {
    input.value = "";
    input.disabled = false;
    input.classList.remove("opacity-50", "cursor-not-allowed");
    btn.innerText = "Без номера";
    clearBtn.classList.add("hidden");
  } else {
    input.value = "Без номера";
    input.disabled = true;
    input.classList.add("opacity-50", "cursor-not-allowed");
    btn.innerText = "С номером";
    clearBtn.classList.add("hidden");
  }
}

document.addEventListener("keydown", function(e) {
  if (!document.getElementById("nameInput")) return;
  if (e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  if (document.activeElement.tagName === "TEXTAREA" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

  document.body.classList.add("using-keyboard");

  // динамические ссылки если режим ссылок
    const linkFields = [];
    if (imageMode === "link") {
      document.querySelectorAll(".imageLink").forEach((input, i) => {
        input.dataset.navId = `dynamicLink_${i}`;
        linkFields.push(`dynamicLink_${i}`);
      });
    }

    // расширенные контакты открыты?
    const extraOpen = !document.getElementById("extraContacts")?.classList.contains("hidden");

    const baseFields = [
      "nameInput",
      "priceInput",
      "mileageInput",
      "plateInput",
      ...linkFields,
      "commentInput",
      "gameInput",
      "phoneInput",
    ];

    const fields = extraOpen ? [...baseFields, "tgInput", "discordInput", "vkInput"] : baseFields;

    const active = document.activeElement;
    const index = fields.findIndex(id => {
      const el = document.getElementById(id) || document.querySelector(`[data-nav-id="${id}"]`);
      return el === active;
    });

  if (index === -1) return;

  e.preventDefault();

  if (e.key === "Enter" || e.key === "ArrowDown") {
      const nextId = fields[index + 1];

      // если следующее поле в расширенных и они закрыты — открываем
      // если дошли до конца списка и расширенные закрыты — открываем и идём в tgInput
            const extraContacts = document.getElementById("extraContacts");
            if (!nextId && extraContacts && extraContacts.classList.contains("hidden")) {
              toggleExtraContacts();
              active.blur();
              setTimeout(() => {
                const nextEl = document.getElementById("tgInput");
                if (nextEl) { nextEl.focus(); nextEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
              }, 300);
              return;
            }

      const next = document.getElementById(nextId) || document.querySelector(`[data-nav-id="${nextId}"]`);
            if (next) {
              active.blur();
              next.focus();
              next.scrollIntoView({ behavior: "smooth", block: "center" });
            }
    }

    if (e.key === "ArrowUp") {
        const prevId = fields[index - 1];

        // если уходим с tgInput вверх — закрываем расширенные если все пустые
        if (fields[index] === "tgInput") {
          const tg = document.getElementById("tgInput")?.value || "";
          const discord = document.getElementById("discordInput")?.value || "";
          const vk = document.getElementById("vkInput")?.value || "";
          const extraContacts = document.getElementById("extraContacts");
          if (!tg && !discord && !vk && extraContacts && !extraContacts.classList.contains("hidden")) {
            toggleExtraContacts();
            active.blur();
            setTimeout(() => {
                        const prevEl = document.getElementById(prevId) || document.querySelector(`[data-nav-id="${prevId}"]`);
                        if (prevEl) { prevEl.focus(); prevEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
                      }, 300);
            return;
          }
        }

        const prev = document.getElementById(prevId) || document.querySelector(`[data-nav-id="${prevId}"]`);
                if (prev) {
                  active.blur();
                  prev.focus();
                  prev.scrollIntoView({ behavior: "smooth", block: "center" });
                }
      }
});

document.addEventListener("mousemove", function() {
  document.body.classList.remove("using-keyboard");
});

function handleCreateBtn() {
  if (!currentUser) {
    if (confirm("Чтобы разместить объявление нужно войти в аккаунт. Войти?")) {
      openAuth("login");
    }
    return;
  }
  window.location.href = "create.html";
}

window.handleCreateBtn = handleCreateBtn;

// ГЛОБАЛЬНЫЕ ФУНКЦИИ
window.openAuth = openAuth;
window.closeAuth = closeAuth;
window.submitAuth = submitAuth;
window.logout = logout;
window.togglePassword = togglePassword;
window.openModal = openModal;
window.closeModal = closeModal;
window.outsideClick = outsideClick;
window.authOutsideClick = authOutsideClick;
window.openModalByIndex = openModalByIndex;
window.deleteCarById = deleteCarById;
window.editCar = editCar;
window.toggleFavorite = toggleFavorite;
window.toggleFavoritesFilter = toggleFavoritesFilter;
window.toggleMyCars = toggleMyCars;
window.clearSearch = clearSearch;
window.toggleServerDropdown = toggleServerDropdown;
window.selectServer = selectServer;
window.highlightItem = highlightItem;
window.toggleContacts = toggleContacts;
window.shareCar = shareCar;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.addCar = addCar;
window.selectFuel = selectFuel;
window.selectCondition = selectCondition;
window.toggleExtraContacts = toggleExtraContacts;
window.goBack = goBack;
window.setImageMode = setImageMode;
window.addLinkInput = addLinkInput;
window.formatPrice = formatPrice;
window.toggleNoPlate = toggleNoPlate;
window.selectServerForm = selectServerForm;
window.goBack = goBack;