var open = false;
var links = document.getElementsByClassName("links")[0];
var toggleNav = document.getElementById("toggle-nav");
toggleNav.onclick = function() {
    if (open) {
        links.style.right = "-100vw";
        toggleNav.classList.add("fa-bars");
        toggleNav.classList.remove("fa-times");
    } else {
        links.style.right = "0";
        toggleNav.classList.add("fa-times");
        toggleNav.classList.remove("fa-bars");
    }
    open = !open;
}