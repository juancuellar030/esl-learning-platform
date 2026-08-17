// Stars Position
let topp=document.getElementById("top")
function setStars(numS){
	for (let i=0; i<numS; i++){
		let stars=document.createElement("div")
		stars.setAttribute("class","stars")
		stars.style.left=100*Math.random()+"%"
		stars.style.top=55*Math.random()+"%"
		topp.appendChild(stars)
	}
}
setStars(250)

// Sun Animation
let sunset=document.getElementById("sun");
function synthSun(nmb){
	for (let i=0; i<nmb*2; i++){
		let sunin=document.createElement("div")
		sunin.setAttribute("class","sun")
		sunin.style.animationDelay=-.5*i++ + "s"
		sunset.appendChild(sunin)
	}
}
synthSun(8)

// Full Screen Function
// For the "full screen" mode I used Isladjan's code from his incredible "Parallax scroll animation". (https://codepen.io/isladjan/pen/abdyPBw)
let fullscreen
let scrn=document.getElementById("fscreen")
scrn.addEventListener("click",function(){
	if(!fullscreen){
		fullscreen=true
		document.documentElement.requestFullscreen()
		scrn.style.textDecoration="line-through 2px red"
	}
	else{
		fullscreen=false
		document.exitFullscreen()
		scrn.style.textDecoration="none"
	}
})