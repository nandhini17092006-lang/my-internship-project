const HASURA_URL =
"https://open-snapper-86.hasura.app/v1/graphql";

const HASURA_SECRET =
"de0rJ8a7EKBvSEuKCk2J9Hy120Rw4IcdbIrThkRa0GN6LPuQBF5m7TTl15c2adh2";

const $ = id => document.getElementById(id);
let cart = JSON.parse(localStorage.getItem("cart")) || {};
let activeCat = "all";
let placing = false;   // blocks double order submit

function setPlaceButtons(busy){
    document.querySelectorAll('button[onclick="placeOrder()"]').forEach(b => b.disabled = busy);
}

function toast(msg, type){
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    $("toasts").appendChild(t);
    setTimeout(() => t.classList.add("out"), 2400);
    setTimeout(() => t.remove(), 2800);
}

function showPage(pageId){
    document.querySelectorAll(".page").forEach(p => p.style.display = "none");
    $(pageId).style.display = pageId === "orderPage" ? "flex" : "block";
    window.scrollTo(0, 0);
    toggleCart(false);
}

function signup(){
    const user = $("newUser").value.trim();
    const email = $("newEmail").value.trim();
    const pass = $("newPass").value;
    if(!user || !email || !pass) return toast("Please fill all fields", "error");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter a valid email", "error");
    if(pass.length < 6) return toast("Password must be at least 6 characters", "error");
    const users = JSON.parse(localStorage.getItem("users")) || [];
    if(users.some(u => u.username === user)) return toast("Username already exists!", "error");
    users.push({username:user, email:email, password:pass});
    localStorage.setItem("users", JSON.stringify(users));
    toast("Signup Successful", "success");
    showPage("loginPage");
}

function login(){
    const user = $("user").value.trim();
    const pass = $("pass").value;
    const users = JSON.parse(localStorage.getItem("users")) || [];
    const valid = users.find(u => u.username === user && u.password === pass);
    if(!valid) return toast("Wrong Username or Password", "error");
    localStorage.setItem("currentUser", JSON.stringify(valid));
    toast("Welcome, " + valid.username + "! 👋", "success");
    showPage("homePage");
}

function logout(){
    localStorage.removeItem("currentUser");
    toast("Logged out successfully");
    showPage("loginPage");
}

/* ---------- CART ---------- */
function cartTotals(){
    let count = 0, total = 0;
    Object.values(cart).forEach(i => { count += i.qty; total += i.qty * i.price; });
    return {count, total};
}

function saveCart(){
    localStorage.setItem("cart", JSON.stringify(cart));
    const {count, total} = cartTotals();
    $("cartCount").innerText = count;
    $("totalPrice").innerText = total;
    $("drawerTotal").innerText = total;
    renderCart();
}

function addToCart(item, price, qtyId){
    let qty = parseInt($(qtyId).value);
    if(!qty || qty < 1) qty = 1;
    cart[item] = cart[item] || {price:price, qty:0};
    cart[item].qty += qty;
    $(qtyId).value = 1;
    saveCart();
    toast(qty + " " + item + " added to cart!", "success");
}

function changeQty(item, d){
    if(!cart[item]) return;
    cart[item].qty += d;
    if(cart[item].qty <= 0) delete cart[item];
    saveCart();
}

function removeItem(item){
    delete cart[item];
    saveCart();
}

function renderCart(){
    const entries = Object.entries(cart);
    $("cartItems").innerHTML = entries.length ? entries.map(([n, i]) => `
        <div class="cart-row">
            <div class="cart-info"><b>${n}</b><span>₹${i.price} each</span></div>
            <div class="stepper">
                <button onclick="changeQty('${n}',-1)">−</button>
                <span>${i.qty}</span>
                <button onclick="changeQty('${n}',1)">+</button>
            </div>
            <div class="cart-price">₹${i.price * i.qty}</div>
            <button class="icon-btn del" onclick="removeItem('${n}')">🗑</button>
        </div>`).join("") : '<p class="empty-cart">Your cart is empty 🍽️</p>';
}

function toggleCart(open){
    $("cartDrawer").classList.toggle("open", open);
}

function viewCart(){
    toggleCart(true);
}

/* ---------- MENU FILTER ---------- */
function filterMenu(){
    const q = $("searchBox").value.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll(".card").forEach(c => {
        const match = c.querySelector("h2").innerText.toLowerCase().includes(q)
            && (activeCat === "all" || c.dataset.cat === activeCat);
        c.style.display = match ? "" : "none";
        if(match) shown++;
    });
    $("noResults").style.display = shown ? "none" : "block";
}

function setCategory(cat, btn){
    activeCat = cat;
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    filterMenu();
}

/* ---------- ORDER ---------- */
async function placeOrder(){
    if(placing) return;
    const items = Object.entries(cart);
    if(!items.length) return toast("❌ Please add items to cart first!", "error");
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if(!user){
        toast("Please login first", "error");
        return showPage("loginPage");
    }
    const {count, total} = cartTotals();
    const foodList = items.map(([n, i]) => n + " x" + i.qty).join(", ");
    placing = true;
    setPlaceButtons(true);
    try{
        const res = await fetch(HASURA_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-hasura-admin-secret": HASURA_SECRET
            },
            body: JSON.stringify({
                query: `mutation($o: orders_insert_input!){
                    insert_orders_one(object: $o){ id }
                }`,
                variables: {o: {
                    username: user.username,
                    email: user.email,
                    food_item: foodList,
                    price: total,
                    quantity: count
                }}
            })
        });
        const data = await res.json();
        if(data.errors) throw new Error(data.errors[0].message);
    }catch(err){
        console.log(err);
        placing = false;
        setPlaceButtons(false);
        return toast("Could not place order. Please try again.", "error");
    }
    $("orderId").innerText = "FO" + Date.now().toString().slice(-6);
    cart = {};
    saveCart();
    showPage("orderPage");
    startTracker();
    placing = false;
    setPlaceButtons(false);
}

function goHome(){
    toast("Order Placed Successfully!", "success");
    showPage("homePage");
}

document.addEventListener("DOMContentLoaded", function(){
    saveCart();
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if(user){
        showPage("homePage");
        toast("Welcome back, " + user.username + "! 👋");
    }else{
        showPage("signupPage");
    }
});

/* ---------- AUTH HELPERS ---------- */
function togglePass(id, btn){
    const i = $(id), show = i.type === "password";
    i.type = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
}

function checkStrength(v){
    let s = 0;
    if(v.length >= 6) s++;
    if(/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if(/\d/.test(v)) s++;
    if(/[^A-Za-z0-9]/.test(v)) s++;
    if(!v) s = 0;
    const L = ["","Weak","Fair","Good","Strong"], C = ["#ddd","#ef4444","#f59e0b","#84cc16","#16c05a"];
    $("strengthBar").style.width = s * 25 + "%";
    $("strengthBar").style.background = C[s];
    $("strengthText").innerText = L[s];
}

/* ---------- MENU EXTRAS ---------- */
function sortMenu(){
    const box = document.querySelector(".container"), mode = $("sortBox").value;
    const price = c => parseInt(c.querySelector(".price").innerText.replace(/\D/g, ""));
    const rate = c => parseFloat(c.querySelector(".rating").innerText.match(/\(([\d.]+)\)/)[1]);
    [...box.children].sort((a, b) =>
        mode === "low" ? price(a) - price(b) :
        mode === "high" ? price(b) - price(a) :
        mode === "top" ? rate(b) - rate(a) : a.dataset.i - b.dataset.i
    ).forEach(c => box.appendChild(c));
}

function surpriseMe(){
    const vis = [...document.querySelectorAll(".card")].filter(c => c.style.display !== "none");
    if(!vis.length) return;
    const pick = vis[Math.floor(Math.random() * vis.length)];
    pick.scrollIntoView({behavior:"smooth", block:"center"});
    pick.classList.add("spotlight");
    setTimeout(() => pick.classList.remove("spotlight"), 2600);
    toast("🎲 How about " + pick.querySelector("h2").innerText + "?");
}

document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll(".card").forEach((c, i) => {
        c.dataset.i = i;
        const r = parseFloat(c.querySelector(".rating").innerText.match(/\(([\d.]+)\)/)[1]);
        if(r >= 4.8){
            const b = document.createElement("span");
            b.className = "ribbon";
            b.textContent = "🔥 Bestseller";
            c.prepend(b);
        }
    });
});


/* ---------- ORDER TRACKER (demo animation) ---------- */
let trackTimers = [];
function startTracker(){
    trackTimers.forEach(clearTimeout);
    ["st1","st2","st3"].forEach(id => $(id).classList.remove("done"));
    $("st1").classList.add("done");
    trackTimers = [
        setTimeout(() => $("st2").classList.add("done"), 4000),
        setTimeout(() => $("st3").classList.add("done"), 8000)
    ];
}
