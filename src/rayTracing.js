var lights = [
	{
		position:  [ 0, 0, 1000 ],
		color: [ 1, 1, 1 ],
		intensity: [ 0.5, 0.5, 0.5 ] // initial shininess is 50%
	},
	{
		position:  [ 0, 1000, 1000 ],
		color: [ 1, 1, 1 ],
		intensity: [ 0.5, 0.5, 0.5 ]
	}
];

const pendolumLen = 0.5;
const pendulumRad = 0.2;

var fixed_spheres = [
	{
		center: [ 0, 0, -10001.0 ],
		radius: 10000.0,
		mtl: {
			k_d: [ 0.1, 0.1, 0.2 ],
			k_s: [ 0.2, 0.2, 0.2 ],
			n: 10
		}
	},
	{
		center: [ 0, 0, 0 ],
		radius: pendulumRad,
		mtl: {
			k_d: [ 0.5, 0.0, 0.0 ],
			k_s: [ 0.8, 0.8, 0.8 ],
			n: 100
		}
	},
	{
		center: [ 0, 0, 0 ],
		radius: pendulumRad,
		mtl: {
			k_d: [ 0.5, 0.0, 0.0 ],
			k_s: [ 0.8, 0.8, 0.8 ],
			n: 100
		}
	},
];

var spheres = fixed_spheres.slice();
var maxBounceLimit = 3;
var perspectiveMatrix;

for (let i = 1; i < spheres.length; i++) {
	spheres[i].center = [0, 0, 0.5-i*pendolumLen];
}

class RayTracer
{
	constructor()
	{
		this.bounceLimit = 5;
		this.showRods = document.getElementById('show-rods').checked;
	}
	init()
	{
		this.initProg( raytraceVS, raytraceFS_primary );
	}
	initProg( vs, fs )
	{
		if ( this.prog ) gl.deleteProgram( this.prog );

		const raytraceFS_head = raytraceFS_header + `
			#define NUM_SPHERES ` + spheres.length + `
			#define NUM_LIGHTS  ` + lights.length + `
			#define MAX_BOUNCES ` + maxBounceLimit + `
		`;
		this.prog = InitShaderProgram( vs, raytraceFS_head+raytraceFS+fs, gl );
		if ( ! this.prog ) return;
		
		function setMaterial( prog, v, mtl )
		{
			gl.uniform3fv( gl.getUniformLocation( prog, v+'.k_d' ), mtl.k_d );
			gl.uniform3fv( gl.getUniformLocation( prog, v+'.k_s' ), mtl.k_s );
			gl.uniform1f ( gl.getUniformLocation( prog, v+'.n'   ), mtl.n   );
		}
		
		gl.useProgram( this.prog );
		gl.uniform1i( gl.getUniformLocation( this.prog, 'bounceLimit' ), this.bounceLimit );
		for ( var i=0; i<spheres.length; ++i ) {
			gl.uniform3fv( gl.getUniformLocation( this.prog, 'spheres['+i+'].center' ), spheres[i].center );
			gl.uniform1f ( gl.getUniformLocation( this.prog, 'spheres['+i+'].radius' ), spheres[i].radius );
			setMaterial( this.prog, 'spheres['+i+'].mtl', spheres[i].mtl );
		}
		for ( var i=0; i<lights.length; ++i ) {
			gl.uniform3fv( gl.getUniformLocation( this.prog, 'lights['+i+'].position'  ), lights[i].position  );
			gl.uniform3fv( gl.getUniformLocation( this.prog, 'lights['+i+'].intensity' ), lights[i].intensity );
		}
        UpdateProjectionMatrixRT();
	}
	updateProj()
	{
		if ( ! this.prog ) return;
		gl.useProgram( this.prog );
		var proj = gl.getUniformLocation( this.prog, 'proj' );
		gl.uniformMatrix4fv( proj, false, perspectiveMatrix );
	}
	draw( trans, pendulums )
	{
		for ( var i=1; i<spheres.length; ++i ) {
			let lastX = 0;
			let lastZ = 0;
			if (i > 1) {
				lastX = pendulums[i-2].x;
				lastZ = 1-pendulums[i-2].y;
			}
			let nextX = (1+pendulums[i-1].base[0])+pendulums[i-1].x+lastX;
			let nextZ = (1+pendulums[i-1].base[2])-pendulums[i-1].y+lastZ;
			gl.uniform3fv( gl.getUniformLocation( this.prog, 'spheres['+i+'].center' ), [nextX, 0, nextZ] );
		}
		if ( ! this.prog ) return;
		screenQuad.draw( this.prog, trans, pendulums, this.showRods );
		if(log)
			printLog();
	}
}

var screenQuad = {
	init( fov, z )
	{
		if ( ! this.vbuf ) this.vbuf = gl.createBuffer();
		const r = canvas.width / canvas.height;
		const ff = Math.PI * fov / 180;
		const tant_2 = Math.tan( ff/2 );
		const y = z * tant_2;
		const x = y * r;
		const rtp = [
			-x, -y, -z,
			 x, -y, -z,
			 x,  y, -z,
			-x, -y, -z,
			 x,  y, -z,
			-x,  y, -z,
		];
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rtp), gl.STATIC_DRAW);
	},
	draw( prog, trans, pendulums, showRods )
	{
		gl.useProgram( prog );

		let loc = gl.getUniformLocation(prog, 'use_rt');
		let aloc = gl.getUniformLocation(prog, 'a_use_rt');
		gl.uniform1f(loc, 1.0);
		gl.uniform1f(aloc, 1.0);

		gl.uniformMatrix4fv( gl.getUniformLocation( prog, 'c2w' ), false, trans.camToWorld );
		gl.uniformMatrix4fv( gl.getUniformLocation( prog, 'w2c' ), false, trans.worldToCam );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vbuf );
		var p = gl.getAttribLocation ( prog, 'p' );
		gl.vertexAttribPointer( p, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( p );
		gl.drawArrays( gl.TRIANGLES, 0, 6 );
		if (!showRods)
			return;
		gl.uniform1f(loc, 0.0);
		gl.uniform1f(aloc, 0.0);
		for(i=0; i<pendulums.length; i++) {
			let line;
			if (i == 0) {
				line = new Float32Array([
					(1+pendulums[i].base[0]), 0, (1+pendulums[i].base[2]),
					(1+pendulums[i].base[0])+pendulums[i].x, 0, (1+pendulums[i].base[2])-pendulums[i].y
				]);
			}else{
				let lastX = pendulums[i-1].x;
				let lastZ = 1-pendulums[i-1].y;
				line = new Float32Array([
					(1+pendulums[i-1].base[0])+pendulums[i-1].x, 0, (1+pendulums[i-1].base[2])-pendulums[0].y,
					(1+pendulums[i].base[0])+pendulums[i].x+lastX, 0, (1+pendulums[i].base[2])-pendulums[i].y+lastZ
				]);
			}
			const lineBuff = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, lineBuff);
			gl.bufferData(gl.ARRAY_BUFFER, line, gl.STATIC_DRAW);
			gl.vertexAttribPointer(p, 3, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(p);
			gl.drawArrays(gl.LINES, 0, 2);
		}
	}
};

var viewRotX=0, viewRotZ=0, transZ=3;
const transZmin = 1.001;
const transZmax = 10;

function GetTrans()
{
	function dot(a,b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

	var cz = Math.cos( viewRotZ );
	var sz = Math.sin( viewRotZ );
	var cx = Math.cos( viewRotX );
	var sx = Math.sin( viewRotX );

	var z = [ cx*sz, -cx*cz, sx ];
	var c = [ z[0]*transZ, z[1]*transZ, z[2]*transZ ];	
	var xlen = Math.sqrt( z[0]*z[0] + z[1]*z[1] );
	var x = [ -z[1]/xlen, z[0]/xlen, 0 ];
	var y = [ z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0] ];
	
	var worldToCam = [
		x[0], y[0], z[0], 0,
		x[1], y[1], z[1], 0,
		x[2], y[2], z[2], 0,
		-dot(x,c), -dot(y,c), -dot(z,c), 1,
	];
	var camToWorld = [
		x[0], x[1], x[2], 0,
		y[0], y[1], y[2], 0,
		z[0], z[1], z[2], 0,
		c[0], c[1], c[2], 1
	];
	return { camToWorld:camToWorld, worldToCam:worldToCam };
}

function UpdateProjectionMatrixRT()
{
	const fov = 60;
	var r = canvas.width / canvas.height;
	var n = 0.1;
	const min_n = 0.001;
	if ( n < min_n ) n = min_n;
	var f = transZmax*100;
	var ff = Math.PI * fov / 180;
	var tant_2 = Math.tan( ff/2 );
	var s = 1 / tant_2;
	perspectiveMatrix = [
		s/r, 0, 0, 0,
		0, s, 0, 0,
		0, 0, -(n+f)/(f-n), -1,
		0, 0, -2*n*f/(f-n), 0
	];
    screenQuad.init(fov, (n+f)/2);
	rt.updateProj();
}