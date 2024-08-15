var lights = [
	{
		position:  [ 0, 0, 1000 ],
		intensity: [ 1, 1, 1 ]
	},
	{
		position:  [ 0, 1000, 1000 ],
		intensity: [ 1, 1, 1 ]
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
	setBounceLimit( bounceLimit )
	{
		this.bounceLimit = bounceLimit;
		if ( ! this.prog ) return;
		gl.useProgram( this.prog );
		gl.uniform1i( gl.getUniformLocation( this.prog, 'bounceLimit' ), this.bounceLimit );
	}
}

class PrimaryRayTracer extends RayTracer
{
	init()
	{
		this.initProg( raytraceVS, raytraceFS_primary );
	}
	draw( trans, pendulums )
	{
		for ( var i=1; i<spheres.length; ++i ) {
			gl.uniform3fv( gl.getUniformLocation( this.prog, 'spheres['+i+'].center' ), [(1+pendulums[i-1].base[0])+pendulums[i-1].x, pendulums[i-1].base[1], (1+pendulums[i-1].base[2])-pendulums[i-1].y] );
		}
		//this.initProg( raytraceVS, raytraceFS_primary );
		//gl.useProgram( this.prog );
		if ( ! this.prog ) return;
		screenQuad.draw( this.prog, trans );
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
	draw( prog, trans )
	{
		gl.useProgram( prog );

		gl.vertexAttrib1f(gl.getUniformLocation(prog, 'use_rt'), 1.0);

		gl.uniformMatrix4fv( gl.getUniformLocation( prog, 'c2w' ), false, trans.camToWorld );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vbuf );
		var p = gl.getAttribLocation ( prog, 'p' );
		gl.vertexAttribPointer( p, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( p );
		gl.drawArrays( gl.TRIANGLES, 0, 6 );
	}
};

class SphereProg
{
	init()
	{
		this.mvp     = gl.getUniformLocation( this.prog, 'mvp' );
		this.campos  = gl.getUniformLocation( this.prog, 'campos' );
		this.center  = gl.getUniformLocation( this.prog, 'center' );
		this.radius  = gl.getUniformLocation( this.prog, 'radius' );
		this.mtl_k_d = gl.getUniformLocation( this.prog, 'mtl.k_d' );
		this.mtl_k_s = gl.getUniformLocation( this.prog, 'mtl.k_s' );
		this.mtl_n   = gl.getUniformLocation( this.prog, 'mtl.n' );
		this.vp      = gl.getAttribLocation ( this.prog, 'p' );
	}
	setTrans( mvp, campos )
	{
		gl.useProgram( this.prog );
		gl.uniformMatrix4fv( this.mvp, false, mvp );
		gl.uniform3fv( this.campos, campos );
	}
	setLight( pos, intens )
	{
		gl.useProgram( this.prog );
		gl.uniform3fv( gl.getUniformLocation( this.prog, 'light.position'  ), pos    );
		gl.uniform3fv( gl.getUniformLocation( this.prog, 'light.intensity' ), intens );
	}
	draw( sphere )
	{
		gl.useProgram( this.prog );
		gl.uniform3fv( this.center,  sphere.center  );
		gl.uniform1f ( this.radius,  sphere.radius  );
		gl.uniform3fv( this.mtl_k_d, sphere.mtl.k_d );
		gl.uniform3fv( this.mtl_k_s, sphere.mtl.k_s );
		gl.uniform1f ( this.mtl_n,   sphere.mtl.n   );
		triSphere.draw( this.vp );
	}
};

class SphereDrawer extends SphereProg
{
	constructor()
	{
		super();
		this.prog = InitShaderProgramFromScripts( sphereVS, sphereFS );
		this.init();
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